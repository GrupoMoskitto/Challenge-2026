#!/bin/bash

set -e

echo "Inicializando LocalStack..."

awslocal s3 mb s3://crmed-documents
awslocal s3 mb s3://crmed-pdfs

echo "Buckets S3 criados: crmed-documents, crmed-pdfs"

awslocal ses verify-identity --email hello@crmed.com.br || true

echo "Identidade SES verificada"

awslocal lambda create-function \
    --function-name pdf-generator \
    --runtime nodejs20.x \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --handler index.handler \
    --zip-file fileb://../../functions/pdf-generator/dist/index.zip \
    --environment "Variables={S3_BUCKET=crmed-pdfs}" \
    || echo "Lambda pdf-generator precisa ser buildada primeiro"

echo "LocalStack pronto!"
