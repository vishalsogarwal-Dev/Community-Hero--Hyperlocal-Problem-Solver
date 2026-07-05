import boto3
from botocore.client import Config
from config import settings


def get_s3_client():
    """Return a boto3 S3 client configured to connect to local MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=settings.minio_url,
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_bucket_exists():
    """Create the media bucket in MinIO if it doesn't already exist."""
    client = get_s3_client()
    bucket = settings.minio_bucket_name
    existing = [b["Name"] for b in client.list_buckets().get("Buckets", [])]
    if bucket not in existing:
        client.create_bucket(Bucket=bucket)
        # Set bucket to public-read so anonymized media is accessible
        client.put_bucket_policy(
            Bucket=bucket,
            Policy=f'''{{
                "Version": "2012-10-17",
                "Statement": [{{
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": "s3:GetObject",
                    "Resource": "arn:aws:s3:::{bucket}/public/*"
                }}]
            }}''',
        )


def upload_file(file_bytes: bytes, object_key: str, content_type: str = "image/jpeg") -> str:
    """Upload bytes to MinIO and return the public URL."""
    client = get_s3_client()
    client.put_object(
        Bucket=settings.minio_bucket_name,
        Key=object_key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return f"{settings.minio_url}/{settings.minio_bucket_name}/{object_key}"
