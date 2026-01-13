import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sqsSubscriptions from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import * as path from "path";

export class RoofGodStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // SECRETS
    // ========================================

    // Store Supabase credentials
    const supabaseSecret = new secretsmanager.Secret(this, "SupabaseSecret", {
      secretName: "roofgod/supabase",
      description: "Supabase connection credentials for RoofGod",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          url: "YOUR_SUPABASE_URL",
          anon_key: "YOUR_SUPABASE_ANON_KEY",
          service_role_key: "YOUR_SUPABASE_SERVICE_ROLE_KEY",
        }),
        generateStringKey: "placeholder",
      },
    });

    // WhatsApp credentials (from AWS End User Messaging)
    const whatsappSecret = new secretsmanager.Secret(this, "WhatsAppSecret", {
      secretName: "roofgod/whatsapp",
      description: "WhatsApp Business API credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          phone_number_id: "YOUR_WHATSAPP_PHONE_NUMBER_ID",
          access_token: "YOUR_WHATSAPP_ACCESS_TOKEN",
        }),
        generateStringKey: "placeholder",
      },
    });

    // Gmail OAuth credentials
    const gmailSecret = new secretsmanager.Secret(this, "GmailSecret", {
      secretName: "roofgod/gmail",
      description: "Gmail OAuth credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          client_id: "YOUR_GOOGLE_CLIENT_ID",
          client_secret: "YOUR_GOOGLE_CLIENT_SECRET",
        }),
        generateStringKey: "placeholder",
      },
    });

    // Token encryption key for storing OAuth tokens
    const encryptionKeySecret = new secretsmanager.Secret(this, "EncryptionKeySecret", {
      secretName: "roofgod/encryption-key",
      description: "Encryption key for OAuth tokens",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "key",
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    // ========================================
    // S3 BUCKET FOR DOCUMENTS
    // ========================================

    const documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
      bucketName: `roofgod-documents-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // ========================================
    // SNS TOPIC FOR WHATSAPP MESSAGES
    // ========================================

    const whatsappIncomingTopic = new sns.Topic(this, "WhatsAppIncomingTopic", {
      topicName: "roofgod-whatsapp-incoming",
      displayName: "RoofGod WhatsApp Incoming Messages",
    });

    // ========================================
    // IAM ROLE FOR LAMBDAS
    // ========================================

    const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });

    // Bedrock permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock-agent-runtime:InvokeAgent",
          "bedrock-agent-runtime:Retrieve",
        ],
        resources: ["*"],
      })
    );

    // Secrets Manager permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          supabaseSecret.secretArn,
          whatsappSecret.secretArn,
          gmailSecret.secretArn,
          encryptionKeySecret.secretArn,
        ],
      })
    );

    // S3 permissions
    documentsBucket.grantReadWrite(lambdaRole);

    // SNS permissions
    whatsappIncomingTopic.grantPublish(lambdaRole);

    // ========================================
    // WHATSAPP WEBHOOK LAMBDA
    // ========================================

    const whatsappWebhookLambda = new lambda.Function(this, "WhatsAppWebhookLambda", {
      functionName: "roofgod-whatsapp-webhook",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/whatsapp-webhook")),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        SUPABASE_SECRET_ARN: supabaseSecret.secretArn,
        WHATSAPP_SECRET_ARN: whatsappSecret.secretArn,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        AWS_REGION_NAME: this.region,
        // Bedrock Agent ID will be set after agent creation
        BEDROCK_AGENT_ID: "PLACEHOLDER",
        BEDROCK_AGENT_ALIAS_ID: "PLACEHOLDER",
      },
    });

    // Subscribe Lambda to SNS topic
    whatsappIncomingTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(whatsappWebhookLambda)
    );

    // ========================================
    // AGENT ACTIONS LAMBDA (for Bedrock AgentCore)
    // ========================================

    const agentActionsLambda = new lambda.Function(this, "AgentActionsLambda", {
      functionName: "roofgod-agent-actions",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/agent-actions")),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        SUPABASE_SECRET_ARN: supabaseSecret.secretArn,
        WHATSAPP_SECRET_ARN: whatsappSecret.secretArn,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
      },
    });

    // Allow Bedrock to invoke the agent actions Lambda
    agentActionsLambda.addPermission("BedrockInvoke", {
      principal: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });

    // ========================================
    // GMAIL POLLER LAMBDA
    // ========================================

    const gmailPollerLambda = new lambda.Function(this, "GmailPollerLambda", {
      functionName: "roofgod-gmail-poller",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/gmail-poller")),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        SUPABASE_SECRET_ARN: supabaseSecret.secretArn,
        WHATSAPP_SECRET_ARN: whatsappSecret.secretArn,
        ENCRYPTION_KEY_SECRET_ARN: encryptionKeySecret.secretArn,
        GOOGLE_GMAIL_CLIENT_ID: "FROM_GMAIL_SECRET",
        GOOGLE_GMAIL_CLIENT_SECRET: "FROM_GMAIL_SECRET",
      },
    });

    // Schedule Gmail poller to run every 15 minutes
    const gmailPollerSchedule = new events.Rule(this, "GmailPollerSchedule", {
      ruleName: "roofgod-gmail-poller-schedule",
      description: "Triggers Gmail poller every 15 minutes",
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
    });

    gmailPollerSchedule.addTarget(new targets.LambdaFunction(gmailPollerLambda));

    // ========================================
    // DOCUMENT PROCESSING QUEUE & LAMBDA
    // ========================================

    // Dead letter queue for failed document processing
    const documentDLQ = new sqs.Queue(this, "DocumentProcessingDLQ", {
      queueName: "roofgod-document-processing-dlq",
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main document processing queue
    const documentQueue = new sqs.Queue(this, "DocumentProcessingQueue", {
      queueName: "roofgod-document-processing",
      visibilityTimeout: cdk.Duration.minutes(6), // Longer than Lambda timeout
      deadLetterQueue: {
        queue: documentDLQ,
        maxReceiveCount: 3,
      },
    });

    // Grant WhatsApp webhook permission to send to queue
    documentQueue.grantSendMessages(lambdaRole);

    // Document processor Lambda
    const documentProcessorLambda = new lambda.Function(this, "DocumentProcessorLambda", {
      functionName: "roofgod-document-processor",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/document-processor")),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024, // Higher memory for image processing
      environment: {
        SUPABASE_SECRET_ARN: supabaseSecret.secretArn,
        WHATSAPP_SECRET_ARN: whatsappSecret.secretArn,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
      },
    });

    // Add SQS trigger to document processor
    documentProcessorLambda.addEventSource(
      new sqsSubscriptions.SqsEventSource(documentQueue, {
        batchSize: 1, // Process one at a time for reliability
      })
    );

    // Update WhatsApp webhook with queue URL
    whatsappWebhookLambda.addEnvironment("DOCUMENT_QUEUE_URL", documentQueue.queueUrl);

    // ========================================
    // DAILY HUDDLE LAMBDA
    // ========================================

    const dailyHuddleLambda = new lambda.Function(this, "DailyHuddleLambda", {
      functionName: "roofgod-daily-huddle",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/daily-huddle")),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        SUPABASE_SECRET_ARN: supabaseSecret.secretArn,
        WHATSAPP_SECRET_ARN: whatsappSecret.secretArn,
      },
    });

    // Schedule daily huddle to run every hour (checks timezone internally)
    const dailyHuddleSchedule = new events.Rule(this, "DailyHuddleSchedule", {
      ruleName: "roofgod-daily-huddle-schedule",
      description: "Triggers daily huddle Lambda every hour to check timezones",
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    dailyHuddleSchedule.addTarget(new targets.LambdaFunction(dailyHuddleLambda));

    // ========================================
    // OUTPUTS
    // ========================================

    new cdk.CfnOutput(this, "WhatsAppWebhookLambdaArn", {
      value: whatsappWebhookLambda.functionArn,
      description: "WhatsApp Webhook Lambda ARN",
    });

    new cdk.CfnOutput(this, "AgentActionsLambdaArn", {
      value: agentActionsLambda.functionArn,
      description: "Agent Actions Lambda ARN",
    });

    new cdk.CfnOutput(this, "DocumentsBucketName", {
      value: documentsBucket.bucketName,
      description: "S3 Bucket for documents",
    });

    new cdk.CfnOutput(this, "WhatsAppTopicArn", {
      value: whatsappIncomingTopic.topicArn,
      description: "SNS Topic for incoming WhatsApp messages",
    });

    new cdk.CfnOutput(this, "SupabaseSecretArn", {
      value: supabaseSecret.secretArn,
      description: "Secrets Manager ARN for Supabase credentials",
    });

    new cdk.CfnOutput(this, "GmailPollerLambdaArn", {
      value: gmailPollerLambda.functionArn,
      description: "Gmail Poller Lambda ARN",
    });

    new cdk.CfnOutput(this, "EncryptionKeySecretArn", {
      value: encryptionKeySecret.secretArn,
      description: "Secrets Manager ARN for token encryption key",
    });

    new cdk.CfnOutput(this, "DocumentProcessorLambdaArn", {
      value: documentProcessorLambda.functionArn,
      description: "Document Processor Lambda ARN",
    });

    new cdk.CfnOutput(this, "DocumentQueueUrl", {
      value: documentQueue.queueUrl,
      description: "SQS Queue URL for document processing",
    });

    new cdk.CfnOutput(this, "DailyHuddleLambdaArn", {
      value: dailyHuddleLambda.functionArn,
      description: "Daily Huddle Lambda ARN",
    });
  }
}
