from openai import OpenAI
import json
import requests

def get_ollama_models():
    """Fetches available models from local Ollama instance."""
    try:
        response = requests.get("http://localhost:11434/api/tags")
        if response.status_code == 200:
            data = response.json()
            return [model['name'] for model in data['models']]
        return []
    except Exception as e:
        print(f"Error fetching Ollama models: {e}")
        return []

def get_word_data(word, api_key=None, provider="openrouter", model=None):
    if provider == "ollama":
        base_url = "http://localhost:11434/v1"
        api_key = "ollama" # Dummy key required by client
        # Use provided model or default to a common one if not specified
        model = model or "llama3" 
    else:
        base_url = "https://openrouter.ai/api/v1"
        model = "openai/gpt-3.5-turbo" # Default for OpenRouter if not specified

    client = OpenAI(
        base_url=base_url,
        api_key=api_key,
    )

    prompt = f"""
    Provide a JSON object for the word "{word}" with the following fields:
    - definition: A clear, simple definition suitable for students.
    - sentence: A sentence using the word in context.
    - synonyms: A comma-separated string of 5-6 synonyms. Ensure they match the part of speech of "{word}".
    - morphology: Explain the word's origin (etymology) and parts (morphology) simply, as if teaching a 10-year-old. Break it down (e.g., prefix, root) if applicable.
    - antonyms: A comma-separated string of 3-4 antonyms. CRITICAL: These MUST match the part of speech of "{word}" (e.g., if "{word}" is a noun, antonyms must be nouns). If there are no clear antonyms, return an empty string.
    
    Ensure the response is valid JSON only.
    """

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful educational assistant. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ]
        )
        
        content = completion.choices[0].message.content
        # Clean up potential markdown code blocks
        content = content.replace("```json", "").replace("```", "").strip()
        
        return json.loads(content)
    except Exception as e:
        print(f"Error fetching data from {provider}: {e}")
        raise e
