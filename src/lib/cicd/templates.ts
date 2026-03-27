export const CI_WORKFLOW = `name: CI - Build & Test
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint || echo "No linter configured"
`;

export const DEPLOY_RAILWAY = `name: Deploy to Railway
on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/nixpacks-action@v1
        with:
          railway-token: \${{ secrets.RAILWAY_TOKEN }}
          service-name: web
`;

export const DEPLOY_AWS = `name: Deploy to AWS (ECS/Fargate)
on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: \${{ vars.ECR_REPOSITORY }}
  ECS_SERVICE: \${{ vars.ECS_SERVICE }}
  ECS_CLUSTER: \${{ vars.ECS_CLUSTER }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: \${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2
        id: login-ecr

      - name: Build, tag, push Docker image
        env:
          ECR_REGISTRY: \${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: \${{ github.sha }}
        run: |
          docker build -t \$ECR_REGISTRY/\$ECR_REPOSITORY:\$IMAGE_TAG .
          docker push \$ECR_REGISTRY/\$ECR_REPOSITORY:\$IMAGE_TAG

      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster \$ECS_CLUSTER --service \$ECS_SERVICE --force-new-deployment
`;

export const DEPLOY_GCP = `name: Deploy to Google Cloud Run
on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  PROJECT_ID: \${{ vars.GCP_PROJECT_ID }}
  REGION: us-central1
  SERVICE_NAME: \${{ vars.GCP_SERVICE_NAME }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GCP_CREDENTIALS }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Build and push to Artifact Registry
        run: |
          gcloud builds submit --tag gcr.io/\$PROJECT_ID/\$SERVICE_NAME

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy \$SERVICE_NAME \\
            --image gcr.io/\$PROJECT_ID/\$SERVICE_NAME \\
            --region \$REGION \\
            --platform managed \\
            --allow-unauthenticated
`;

export interface DeployTemplate {
  id: string;
  name: string;
  provider: string;
  description: string;
  workflow: string;
  requiredSecrets: string[];
  requiredVars: string[];
}

export const DEPLOY_TEMPLATES: DeployTemplate[] = [
  {
    id: "railway",
    name: "Railway",
    provider: "railway",
    description: "Deploy to Railway with automatic builds via Nixpacks",
    workflow: DEPLOY_RAILWAY,
    requiredSecrets: ["RAILWAY_TOKEN"],
    requiredVars: [],
  },
  {
    id: "aws",
    name: "AWS (ECS/Fargate)",
    provider: "aws",
    description: "Deploy to AWS ECS with Docker images pushed to ECR",
    workflow: DEPLOY_AWS,
    requiredSecrets: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    requiredVars: ["ECR_REPOSITORY", "ECS_SERVICE", "ECS_CLUSTER"],
  },
  {
    id: "gcp",
    name: "Google Cloud Run",
    provider: "gcp",
    description: "Deploy to Google Cloud Run with automatic container builds",
    workflow: DEPLOY_GCP,
    requiredSecrets: ["GCP_CREDENTIALS"],
    requiredVars: ["GCP_PROJECT_ID", "GCP_SERVICE_NAME"],
  },
];
