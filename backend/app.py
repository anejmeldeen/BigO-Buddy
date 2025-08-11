from flask import Flask, request, jsonify
import requests
import os
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins for testing

@app.route("/analyze", methods=["POST", "OPTIONS"])
def analyze():
    if request.method == "OPTIONS":
        # Respond OK to preflight requests without parsing body
        return '', 200

    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    code = data.get("code", "")
    language = data.get("language", "Python")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"error": "API key not set"}), 500

    prompt = f"""You are a coding assistant. Given the following {language} code, 
provide a short, easy-to-understand blurb explaining the runtime complexity.
Return in the following format: [complexity];[explanation]
For example: "O(nlog(n));Explanation....."
If the code is NOT the correct language or is unreadable, output "N/A;[Explanation]"
Please ensure the coding language matches the code.

Code:
{code}
"""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    json_data = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 200
    }

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=json_data
    )

    if response.status_code != 200:
        return jsonify({"error": "OpenAI API request failed", "details": response.text}), 500

    data = response.json()
    answer = data["choices"][0]["message"]["content"]

    return jsonify({"result": answer})


if __name__ == "__main__":
    app.run(debug=True)
