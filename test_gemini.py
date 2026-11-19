import os
from dotenv import load_dotenv
from google import genai


# Load variables from .env
load_dotenv()


# Get Gemini API key
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("ERROR: GEMINI_API_KEY not found in .env")
    print("Make sure your .env file contains:")
    print("GEMINI_API_KEY=YOUR_API_KEY")
    exit()


# Create Gemini client
client = genai.Client(api_key=api_key)


# Send a simple test request
try:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say exactly: NetSage AI Gemini connection successful"
    )

    print("\n" + "=" * 50)
    print("GEMINI CONNECTION TEST")
    print("=" * 50)
    print("\nResponse:")
    print(response.text)
    print("\n" + "=" * 50)
    print("SUCCESS")
    print("=" * 50)

except Exception as e:
    print("\n" + "=" * 50)
    print("GEMINI CONNECTION FAILED")
    print("=" * 50)
    print("\nError:")
    print(e)
    print("\n" + "=" * 50)