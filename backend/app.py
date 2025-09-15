import os

from fastapi import FastAPI
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://api.openai.com/v1",
)
model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

app = FastAPI()


@app.get("/health")
def health():
    return {"model": model}
