from flask import Flask, request, jsonify, send_from_directory
import ollama
import os
import base64
import time
import threading
from flask_cors import CORS
import uuid
import fitz
import requests
import tempfile
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../build')
CORS(app)  # Enable CORS for all routes

# Configure folders
UPLOAD_FOLDER = 'uploads'
PDF_FOLDER = 'pdfs'
for folder in [UPLOAD_FOLDER, PDF_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)

# Global variables for Ollama status
ollama_status = {
    "service_available": False,
    "models": {
        "llama3.2-vision:latest": False,
        "mistral:latest": False
    },
    "model_details": {
        "llama3.2-vision:latest": {"status": "unknown", "error": None},
        "mistral:latest": {"status": "unknown", "error": None}
    },
    "last_check": None
}

def check_ollama_service():
    """Check if Ollama service is running and verify model availability"""
    global ollama_status
    
    # Update timestamp
    ollama_status["last_check"] = time.time()
    
    try:
        # Check if Ollama service is running
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        
        if response.status_code != 200:
            logger.error(f"Ollama service returned status code: {response.status_code}")
            ollama_status["service_available"] = False
            return False
            
        # Service is available
        ollama_status["service_available"] = True
        logger.info("✅ Ollama service is running")
        
        # Get list of available models
        available_models = response.json().get("models", [])
        model_names = [model.get("name", "") for model in available_models]
        
        # Check our required models
        for model_name in ollama_status["models"].keys():
            base_model_name = model_name.split(":")[0]
            if model_name in model_names or any(base_model_name in m for m in model_names):
                ollama_status["models"][model_name] = True
                ollama_status["model_details"][model_name]["status"] = "available"
                logger.info(f"✅ Model {model_name} is available")
            else:
                ollama_status["models"][model_name] = False
                ollama_status["model_details"][model_name]["status"] = "not_found"
                ollama_status["model_details"][model_name]["error"] = f"Model {model_name} not found"
                logger.warning(f"⚠️ Model {model_name} is not available. Please run: ollama pull {model_name}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Cannot connect to Ollama service: {e}")
        ollama_status["service_available"] = False
        return False

def test_model(model_name):
    """Test if a model can be used by sending a simple request"""
    try:
        logger.info(f"Testing model {model_name}...")
        response = ollama.chat(
            model=model_name,
            messages=[{'role': 'user', 'content': 'Hello, test message'}]
        )   
        ollama_status["models"][model_name] = True
        ollama_status["model_details"][model_name]["status"] = "working"
        ollama_status["model_details"][model_name]["error"] = None
        logger.info(f"✅ Model {model_name} is working")
        return True
    except Exception as e:
        ollama_status["models"][model_name] = False
        ollama_status["model_details"][model_name]["status"] = "error"
        ollama_status["model_details"][model_name]["error"] = str(e)
        logger.error(f"❌ Error testing model {model_name}: {e}")
        return False

def initialize_ollama():
    """Initialize connection to Ollama and test models"""
    # First check if service is available
    if not check_ollama_service():
        logger.warning("⚠️ Ollama service is not available. Application will start but AI features won't work.")
        logger.warning("Please install Ollama from https://ollama.com/download and start the service")
        return
    
    # Test each model with a simple request
    for model_name in ollama_status["models"].keys():
        if ollama_status["models"][model_name]:
            # Only test models that are reported as available
            test_model(model_name)

# Start initialization in a separate thread
threading.Thread(target=initialize_ollama).start()

# Store chat histories for different sessions
chat_histories = {}

@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/status', methods=['GET'])
def status():
    """Return the current status of Ollama and models"""
    # If it's been more than 30 seconds since our last check, refresh status
    if not ollama_status["last_check"] or time.time() - ollama_status["last_check"] > 30:
        check_ollama_service()
        
    return jsonify({
        'ollama_service': ollama_status["service_available"],
        'models': ollama_status["models"],
        'model_details': ollama_status["model_details"],
        'last_check': ollama_status["last_check"]
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    session_id = data.get('sessionId', str(uuid.uuid4()))
    message_text = data.get('text', '')
    image_data = data.get('image')
    model_name = data.get('model', 'llama3.2-vision:latest')
    
    # Check if Ollama service is available
    if not ollama_status["service_available"]:
        if not check_ollama_service():
            return jsonify({
                'sessionId': session_id,
                'response': "⚠️ Ollama service is not available. Please start Ollama and try again."
            }), 503
    
    # Check if the requested model is available
    if model_name in ollama_status["models"] and not ollama_status["models"][model_name]:
        return jsonify({
            'sessionId': session_id,
            'response': f"⚠️ Model {model_name} is not available. Please run: ollama pull {model_name}"
        }), 400
    
    # Initialize this session if it doesn't exist
    if session_id not in chat_histories:
        chat_histories[session_id] = []
    
    # Prepare the message
    user_message = {
        'role': 'user',
        'content': message_text
    }
    
    # If image is included, save it and add to message
    if image_data:
        try:
            # Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            # Create a unique filename
            image_filename = f"{session_id}_{int(time.time())}.jpg"
            image_path = os.path.join(UPLOAD_FOLDER, image_filename)
            
            # Save the image
            with open(image_path, 'wb') as f:
                f.write(base64.b64decode(image_data))
            
            # Add image to message
            user_message['images'] = [image_path]
            logger.info(f"Image saved to {image_path}")
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            return jsonify({
                'sessionId': session_id,
                'response': f"Error processing image: {str(e)}"
            }), 400
    
    # Add user message to history
    chat_histories[session_id].append(user_message)
    
    try:
        # Get model response
        logger.info(f"Sending request to model {model_name}")
        response = ollama.chat(
            model=model_name,
            messages=chat_histories[session_id]
        )
        
        # Add assistant's response to history
        chat_histories[session_id].append(response['message'])
        
        return jsonify({
            'sessionId': session_id,
            'response': response['message']['content']
        })
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error from Ollama: {error_msg}")
        
        # Try to provide helpful error messages
        if "failed to connect" in error_msg.lower():
            ollama_status["service_available"] = False
            return jsonify({
                'sessionId': session_id,
                'response': "⚠️ Lost connection to Ollama service. Please check if Ollama is still running."
            }), 503
        elif "no such model" in error_msg.lower() or "model not found" in error_msg.lower():
            ollama_status["models"][model_name] = False
            ollama_status["model_details"][model_name]["status"] = "not_found"
            ollama_status["model_details"][model_name]["error"] = error_msg
            return jsonify({
                'sessionId': session_id,
                'response': f"⚠️ Model {model_name} not found. Please run: ollama pull {model_name}"
            }), 400
        
        return jsonify({
            'sessionId': session_id,
            'response': f"⚠️ Error: {error_msg}"
        }), 500

@app.route('/api/upload_pdf', methods=['POST'])
def upload_pdf():
    # Check if Ollama is available
    if not ollama_status["service_available"]:
        if not check_ollama_service():
            return jsonify({
                'error': "⚠️ Ollama service is not available. Please start Ollama and try again."
            }), 503
    
    # Check if PDF file was provided
    if 'pdf' not in request.files:
        return jsonify({'error': 'No PDF file provided'}), 400
        
    pdf_file = request.files['pdf']
    if pdf_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Check if the file is actually a PDF
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File does not appear to be a PDF'}), 400
        
    try:
        # Save the uploaded PDF
        pdf_filename = f"{int(time.time())}_{pdf_file.filename}"
        pdf_path = os.path.join(PDF_FOLDER, pdf_filename)
        pdf_file.save(pdf_path)
        logger.info(f"PDF saved to {pdf_path}")
        
        # Extract text from the PDF
        text = extract_text_from_pdf(pdf_path)
        
        if not text:
            return jsonify({'error': 'Could not extract text from PDF. The file may be empty or corrupted.'}), 400
            
        # Check Mistral model availability for analysis
        model_name = "mistral:latest"
        
        # Test Mistral specifically before attempting analysis
        if not test_model(model_name):
            analysis = f"⚠️ Cannot perform analysis: Model {model_name} is not available or not working correctly. Error: {ollama_status['model_details'][model_name]['error']}. Please run: ollama pull {model_name}"
        else:
            # Get initial analysis
            analysis = get_initial_analysis(text)
        
        return jsonify({
            'text': text,
            'analysis': analysis,
            'filename': pdf_filename,
            'modelStatus': ollama_status['model_details'][model_name]
        })
    except Exception as e:
        logger.error(f"Error processing PDF: {e}")
        return jsonify({'error': f"Error processing PDF: {str(e)}"}), 500

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file using PyMuPDF (fitz)."""
    logger.info(f"Extracting text from: {os.path.basename(pdf_path)}")
    text = ""
    try:
        # Open the PDF
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        
        logger.info(f"PDF has {total_pages} pages")
        
        # Extract text from each page
        for page_num in range(total_pages):
            page = doc.load_page(page_num)
            page_text = page.get_text()
            text += page_text
            
            # Log progress for every 5th page to avoid log flooding
            if page_num % 5 == 0 or page_num == total_pages - 1:
                progress = (page_num + 1) / total_pages * 100
                logger.info(f"Progress: {progress:.1f}% (Page {page_num + 1}/{total_pages})")
            
        logger.info("Text extraction complete!")
        
        # Close the document
        doc.close()
        return text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return ""

def get_initial_analysis(text):
    """Get the initial analysis of the PDF text from Mistral."""
    logger.info("Getting initial analysis...")
    
    model_name = "mistral:latest"
    
    # Prepare the prompt for the initial analysis
    prompt = f"""
    I have extracted text from a PDF document. Please:
    1. Identify the document type
    2. Summarize the key points
    3. Extract any important dates, names, or numerical data
    
    Here is the extracted text:
    {text[:5000]}  # Sending first 5000 chars to avoid token limits
    """
    
    try:
        # Get model response with timeout and error handling
        logger.info(f"Sending analysis request to {model_name}")
        
        # Set a timeout for the request to avoid hanging
        response = ollama.chat(
            model=model_name,
            messages=[{'role': 'user', 'content': prompt}]
        )
        
        # Mark model as working
        ollama_status["models"][model_name] = True
        ollama_status["model_details"][model_name]["status"] = "working"
        ollama_status["model_details"][model_name]["error"] = None
        
        return response['message']['content']
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error with analysis: {error_msg}")
        
        # Update model status if it's a model-related error
        if "no such model" in error_msg.lower() or "model not found" in error_msg.lower():
            ollama_status["models"][model_name] = False
            ollama_status["model_details"][model_name]["status"] = "not_found"
            ollama_status["model_details"][model_name]["error"] = error_msg
            return f"⚠️ Cannot analyze document: Model {model_name} is not available. Please run: ollama pull {model_name}"
        elif "context" in error_msg.lower() and "length" in error_msg.lower():
            # Handle context length errors
            ollama_status["model_details"][model_name]["error"] = error_msg
            return f"⚠️ The PDF document is too large for the model's context window. Try asking specific questions about sections instead."
        else:
            # Other errors
            ollama_status["model_details"][model_name]["status"] = "error"
            ollama_status["model_details"][model_name]["error"] = error_msg
            return f"⚠️ Error analyzing the document: {error_msg}. You can still ask questions about it."

@app.route('/api/pdf_question', methods=['POST'])
def pdf_question():
    data = request.json
    question = data.get('text', '')
    pdf_text = data.get('pdfText', '')
    model_name = data.get('model', 'mistral:latest')
    
    # Check if Ollama service is available
    if not ollama_status["service_available"]:
        if not check_ollama_service():
            return jsonify({
                'response': "⚠️ Ollama service is not available. Please start Ollama and try again."
            }), 503
    
    # Test model before trying to use it
    if not test_model(model_name):
        return jsonify({
            'response': f"⚠️ Model {model_name} is not working: {ollama_status['model_details'][model_name]['error']}. Please run: ollama pull {model_name}"
        }), 400
    
    if not pdf_text:
        return jsonify({'response': 'No PDF text available to answer questions.'})
    
    # Prepare the prompt for the question - modified to handle larger documents better
    prompt = f"""
    Based on the following PDF text, please answer this question:
    
    QUESTION: {question}
    
    PDF TEXT (first 3000 chars):
    {pdf_text[:3000]}
    
    PDF TEXT (middle 3000 chars):
    {pdf_text[len(pdf_text)//2 - 1500:len(pdf_text)//2 + 1500]}
    
    PDF TEXT (last 3000 chars):
    {pdf_text[-3000:]}
    
    Please provide a clear and direct answer based only on the information in the document.
    If the information is not in the document, please state that clearly.
    """
    
    try:
        # Get model response
        logger.info(f"Sending PDF question to model {model_name}")
        response = ollama.chat(
            model=model_name,
            messages=[{'role': 'user', 'content': prompt}]
        )
        
        # Mark model as working
        ollama_status["models"][model_name] = True
        ollama_status["model_details"][model_name]["status"] = "working"
        
        return jsonify({
            'response': response['message']['content']
        })
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error from Ollama: {error_msg}")
        
        # Try to provide helpful error messages
        if "failed to connect" in error_msg.lower():
            ollama_status["service_available"] = False
            return jsonify({
                'response': "⚠️ Lost connection to Ollama service. Please check if Ollama is still running."
            }), 503
        elif "no such model" in error_msg.lower() or "model not found" in error_msg.lower():
            ollama_status["models"][model_name] = False
            ollama_status["model_details"][model_name]["status"] = "not_found"
            ollama_status["model_details"][model_name]["error"] = error_msg
            return jsonify({
                'response': f"⚠️ Model {model_name} not found. Please run: ollama pull {model_name}"
            }), 400
        elif "context" in error_msg.lower() and "length" in error_msg.lower():
            # Handle context length errors
            ollama_status["model_details"][model_name]["error"] = error_msg
            return jsonify({
                'response': f"⚠️ The PDF document is too large for the model's context window. Try asking about a specific section instead."
            }), 400
        
        # Mark model as having an error
        ollama_status["model_details"][model_name]["status"] = "error"
        ollama_status["model_details"][model_name]["error"] = error_msg
        
        return jsonify({
            'response': f"⚠️ Error: {error_msg}"
        }), 500

# Reset chat history
@app.route('/api/reset', methods=['POST'])
def reset_chat():
    data = request.json
    session_id = data.get('sessionId')
    
    if session_id and session_id in chat_histories:
        chat_histories[session_id] = []
        logger.info(f"Chat history reset for session {session_id}")
        return jsonify({'status': 'Chat history reset successfully'})
    
    return jsonify({'status': 'Session not found'}), 404

# Route to manually refresh Ollama status and retry model connections
@app.route('/api/refresh', methods=['GET'])
def refresh_ollama():
    """Manually refresh Ollama status and test models"""
    service_available = check_ollama_service()
    
    if service_available:
        # Test models in a separate thread to avoid blocking
        threading.Thread(target=lambda: [test_model(model) for model in ollama_status["models"].keys()]).start()
        
        return jsonify({
            'status': 'Refreshing Ollama status and testing models',
            'service_available': True,
            'current_status': ollama_status
        })
    else:
        return jsonify({
            'status': 'Ollama service is not available',
            'message': 'Please make sure Ollama is installed and running: https://ollama.com/download'
        }), 503

# New route to specifically test the Mistral model
@app.route('/api/test_mistral', methods=['GET'])
def test_mistral_route():
    """Test if the Mistral model is working properly"""
    model_name = "mistral:latest"
    
    # Check if Ollama service is available
    if not ollama_status["service_available"]:
        if not check_ollama_service():
            return jsonify({
                'status': 'error',
                'message': "⚠️ Ollama service is not available. Please start Ollama and try again."
            }), 503
    
    # Test Mistral model with a short prompt
    model_working = test_model(model_name)
    
    if model_working:
        return jsonify({
            'status': 'success',
            'message': f"✅ Model {model_name} is working properly",
            'model_status': ollama_status["model_details"][model_name]
        })
    else:
        # Get details about the error
        error = ollama_status["model_details"][model_name]["error"]
        
        # Provide instructions based on error type
        if "no such model" in str(error).lower() or "model not found" in str(error).lower():
            message = f"⚠️ Model {model_name} is not installed. Please run: ollama pull {model_name}"
        else:
            message = f"⚠️ Model {model_name} is not working properly. Error: {error}"
        
        return jsonify({
            'status': 'error',
            'message': message,
            'model_status': ollama_status["model_details"][model_name],
            'fix_command': f"ollama pull {model_name}"
        }), 400

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    logger.info("Will check Ollama service availability in the background...")
    logger.info("Server is starting on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)