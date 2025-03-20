import os
import sys
import fitz  # PyMuPDF
import requests
import tkinter as tk
from tkinter import filedialog
import json
import time

def select_pdf_file():
    """Open a file dialog to select a PDF file."""
    # Create a root window but hide it
    root = tk.Tk()
    root.withdraw()
    
    # Show the file dialog and get the selected file path
    file_path = filedialog.askopenfilename(
        title="Select PDF file",
        filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")]
    )
    
    # Destroy the root window
    root.destroy()
    
    return file_path

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file using PyMuPDF (fitz)."""
    print(f"Extracting text from: {os.path.basename(pdf_path)}")
    text = ""
    try:
        # Open the PDF
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        
        print(f"PDF has {total_pages} pages")
        
        # Extract text from each page
        for page_num in range(total_pages):
            page = doc.load_page(page_num)
            page_text = page.get_text()
            text += page_text
            
            # Print progress
            progress = (page_num + 1) / total_pages * 100
            print(f"Progress: {progress:.1f}% (Page {page_num + 1}/{total_pages})", end="\r")
            
        # Complete the progress line
        print("\nText extraction complete!")
        
        # Close the document
        doc.close()
        return text
    except Exception as e:
        print(f"\nError extracting text from PDF: {e}")
        return ""

def get_initial_analysis(text, api_endpoint="http://localhost:11434/api/generate", model="mistral:latest"):
    """Get the initial analysis of the PDF text from Mistral."""
    print(f"\nGetting initial analysis with {model}...")
    print(f"Sending {len(text)} characters to the model")
    
    # Prepare the prompt for the initial analysis
    prompt = f"""
    I have extracted text from a PDF document. Please:
    1. Identify the document type
    2. Summarize the key points
    3. Extract any important dates, names, or numerical data
    
    Here is the extracted text:
    {text[:10000]}  # Sending first 10000 chars to avoid token limits
    """
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    
    try:
        # Start timing
        start_time = time.time()
        
        # Send the request to the Ollama API
        print("Sending request to Mistral model...")
        response = requests.post(api_endpoint, json=payload)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Check if request was successful
        if response.status_code == 200:
            result = response.json()
            print(f"Analysis complete! (Took {processing_time:.2f} seconds)")
            return result
        else:
            print(f"Error: API returned status code {response.status_code}")
            return {"error": f"API error: {response.status_code}", "text": response.text}
    except Exception as e:
        print(f"Error connecting to Mistral model: {e}")
        return {"error": str(e)}

def ask_questions_about_pdf(text, api_endpoint="http://localhost:11434/api/generate", model="mistral:latest"):
    """Allow the user to ask questions about the PDF content."""
    print("\n" + "="*80)
    print("ASK QUESTIONS ABOUT THE PDF")
    print("="*80)
    print("Type your question or 'exit' to finish asking questions.")
    
    while True:
        # Get user question
        user_question = input("\nYour question: ")
        
        # Check if user wants to exit
        if user_question.lower() == 'exit':
            print("Exiting question mode.")
            break
        
        if not user_question.strip():
            print("Please enter a valid question.")
            continue
        
        # Process the question with Mistral
        print(f"Processing your question: '{user_question}'")
        
        # Prepare the prompt for the question
        prompt = f"""
        Based on the following PDF text, please answer this question:
        
        QUESTION: {user_question}
        
        PDF TEXT:
        {text[:10000]}  # Sending first 10000 chars to avoid token limits
        
        Please provide a clear and direct answer based only on the information in the document.
        """
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        
        try:
            # Send the request to the Ollama API
            print("Sending question to Mistral model...")
            response = requests.post(api_endpoint, json=payload)
            
            # Check if request was successful
            if response.status_code == 200:
                result = response.json()
                
                # Display the answer
                print("\n" + "="*80)
                print("ANSWER:")
                print("="*80)
                
                if "response" in result:
                    print(result["response"])
                else:
                    print(f"Error processing question: {json.dumps(result, indent=2)}")
            else:
                print(f"Error: API returned status code {response.status_code}")
        except Exception as e:
            print(f"Error processing question: {e}")

def display_initial_analysis(text, analysis_result):
    """Display the extracted text and initial analysis results in the terminal."""
    # Display a section of the extracted text
    print("\n" + "="*80)
    print("EXTRACTED TEXT SAMPLE (first 1000 characters):")
    print("="*80)
    print(text[:1000] + "...\n")
    print(f"Total extracted text length: {len(text)} characters")
    
    # Display the analysis results
    print("\n" + "="*80)
    print("INITIAL MISTRAL ANALYSIS:")
    print("="*80)
    
    if "response" in analysis_result:
        print(analysis_result["response"])
    else:
        print(f"Error in processing: {json.dumps(analysis_result, indent=2)}")

def main():
    # Display welcome message
    print("PDF Analyzer with Mistral".center(80, "="))
    print("This tool extracts text from a PDF, analyzes it, and answers your questions")
    print("="*80 + "\n")
    
    # Check if Ollama is running
    try:
        health_check = requests.get("http://localhost:11434/api/tags")
        if health_check.status_code != 200:
            print("Warning: Ollama API doesn't seem to be responding correctly.")
            print("Make sure Ollama is running with: ollama serve")
    except requests.exceptions.ConnectionError:
        print("Error: Cannot connect to Ollama API.")
        print("Please start Ollama with: ollama serve")
        print("Then run this script again.")
        return
        
    # Get the file path
    print("Please select a PDF file...")
    pdf_path = select_pdf_file()
    
    if not pdf_path:
        print("No file selected. Exiting.")
        return
    
    # Extract text from the PDF
    text = extract_text_from_pdf(pdf_path)
    
    if not text:
        print("No text extracted. Exiting.")
        return
    
    # Get initial analysis from Mistral
    initial_analysis = get_initial_analysis(text)
    
    # Display the initial analysis
    display_initial_analysis(text, initial_analysis)
    
    # Ask if the user wants to ask questions about the PDF
    print("\n" + "="*80)
    ask_questions = input("Would you like to ask questions about the PDF? (y/n): ").lower()
    
    if ask_questions == 'y':
        # Allow user to ask questions about the PDF
        ask_questions_about_pdf(text)
    
    # Ask if the user wants to save the results
    save_choice = input("\nDo you want to save the extracted text and initial analysis to files? (y/n): ").lower()
    
    if save_choice == 'y':
        output_dir = os.path.dirname(pdf_path)
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        
        # Save extracted text
        text_file = os.path.join(output_dir, f"{base_name}_extracted_text.txt")
        with open(text_file, 'w', encoding='utf-8') as f:
            f.write(text)
        
        # Save initial analysis
        analysis_file = os.path.join(output_dir, f"{base_name}_mistral_analysis.txt")
        with open(analysis_file, 'w', encoding='utf-8') as f:
            if "response" in initial_analysis:
                f.write(initial_analysis["response"])
            else:
                f.write(f"Error in processing: {json.dumps(initial_analysis, indent=2)}")
        
        print(f"\nSaved extracted text to: {text_file}")
        print(f"Saved Mistral analysis to: {analysis_file}")
    
    print("\nThank you for using the PDF Analyzer!")

if __name__ == "__main__":
    main()