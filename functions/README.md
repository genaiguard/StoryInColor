# Firebase Functions Email Service

This package contains the backend code for StoryInColor, including email notifications using AWS SES.

## Email Functionality

The email service provides two main functions:

1. **Welcome Emails**: Sent when a user registers
2. **Project Submission Emails**: Sent when a user submits a project

## Setup Instructions

### AWS SES Setup

1. **Set up AWS SES**:
   - Create an AWS account if you don't have one
   - Verify your domain or at least the sender email in AWS SES
   - If your account is in the SES sandbox, verify recipient email addresses for testing
   - Create an IAM user with programmatic access and SES permissions

2. **Configure AWS CLI**:
   ```bash
   aws configure
   aws ses verify-domain-identity --domain yourdomain.com
   aws ses verify-domain-dkim --domain yourdomain.com
   ```

3. **Add DNS records to your domain provider**:
   - Add the TXT record for domain verification
   - Add the CNAME records for DKIM verification
   - Wait for DNS propagation (24-48 hours)

4. **Verify setup**:
   ```bash
   aws ses get-identity-verification-attributes --identities yourdomain.com
   ```

### Firebase Setup

1. **Install the AWS SDK**:
   ```bash
   npm install aws-sdk --save
   ```

2. **Set up Firebase secrets**:
   Run the included setup script to configure your AWS credentials in Firebase:
   ```bash
   ./setup-email-secrets.sh
   ```

   This script will prompt you for:
   - AWS Access Key ID
   - AWS Secret Access Key
   - AWS Region (defaults to us-east-1)
   - Sender Email Address (must be verified in AWS SES)

3. **Deploy functions**:
   ```bash
   firebase deploy --only functions
   ```

## Usage

The email functions are automatically called at the appropriate times:

- When a user registers, a welcome email is sent
- When a user submits a project, a notification email is sent

No additional configuration is required in the client code, as the integration has been built into the registration and project submission flows. 