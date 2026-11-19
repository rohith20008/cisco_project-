import requests


OLLAMA_URL = "http://localhost:11434/api/generate"


def test_ollama():

    payload = {
        "model": "qwen2.5:7b",
        "prompt": "Say exactly: NetSage AI local model connection successful",
        "stream": False
    }

    try:

        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=120
        )

        response.raise_for_status()

        data = response.json()

        print("\n" + "=" * 60)
        print("OLLAMA CONNECTION TEST")
        print("=" * 60)

        print("\nModel response:")
        print(data["response"])

        print("\n" + "=" * 60)
        print("SUCCESS")
        print("=" * 60)

    except requests.exceptions.ConnectionError:

        print("\nERROR: Ollama is not running.")
        print("Open Ollama and try again.")

    except requests.exceptions.Timeout:

        print("\nERROR: Ollama took too long to respond.")

    except Exception as e:

        print("\nERROR:")
        print(e)


if __name__ == "__main__":
    test_ollama()