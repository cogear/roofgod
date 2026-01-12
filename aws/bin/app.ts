#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RoofGodStack } from "../lib/roofgod-stack";

const app = new cdk.App();

new RoofGodStack(app, "RoofGodStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  description: "RoofGod - Siteless AI SaaS for Roofing Contractors",
});
