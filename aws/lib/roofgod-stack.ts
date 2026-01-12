import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
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
        resources: [supabaseSecret.secretArn, whatsappSecret.secretArn],
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
  }
}
