from PyPDF2 import PdfMerger
import os
import tkinter as tk
from tkinter import filedialog, messagebox

def select_pdfs():
    """
    Opens a file dialog for the user to select multiple PDF files.
    Returns a list of selected file paths.
    """
    root = tk.Tk()
    root.withdraw()  # Hide the main window
    
    file_paths = filedialog.askopenfilenames(
        title="Select multiple PDF files (Ctrl+click or Shift+click to select multiple)",
        filetypes=[("PDF files", "*.pdf")],
        multiple=True
    )
    
    return list(file_paths)

def merge_pdfs(output_path="merged.pdf"):
    """
    Merges selected PDF files and saves the merged file to the specified output path.
    """
    # Get PDF files through the file dialog
    pdf_files = select_pdfs()
    
    if not pdf_files:
        print("No files selected. Operation cancelled.")
        return False
    
    # Get output file location
    root = tk.Tk()
    root.withdraw()
    output_path = filedialog.asksaveasfilename(
        defaultextension=".pdf",
        filetypes=[("PDF files", "*.pdf")],
        title="Save merged PDF as"
    )
    
    if not output_path:
        print("No output location selected. Operation cancelled.")
        return False
    
    try:
        merger = PdfMerger()
        
        # Add each selected PDF to the merger
        for pdf in pdf_files:
            merger.append(pdf)
        
        # Write the merged PDF to the output file
        merger.write(output_path)
        merger.close()
        
        print(f"Successfully merged {len(pdf_files)} PDF files into {output_path}")
        return True, len(pdf_files), output_path
    
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return False, 0, ""

def main():
    """
    Main function to run the program with a simple GUI.
    """
    root = tk.Tk()
    root.title("PDF Merger")
    root.geometry("500x250")
    
    frame = tk.Frame(root, padx=20, pady=20)
    frame.pack(expand=True, fill="both")
    
    label = tk.Label(
        frame, 
        text="Merge multiple PDF files into one document",
        font=("Arial", 12, "bold")
    )
    label.pack(pady=10)
    
    instructions = tk.Label(
        frame,
        text="You can select multiple files by holding Ctrl (or ⌘ on Mac)\nwhile clicking, or Shift+click to select a range of files.",
        font=("Arial", 10),
        justify="center"
    )
    instructions.pack(pady=5)
    
    merge_button = tk.Button(
        frame,
        text="Select and Merge PDFs",
        command=lambda: merge_and_show_result(root),
        font=("Arial", 10, "bold"),
        padx=15,
        pady=8,
        bg="#4a7abc",
        fg="white"
    )
    merge_button.pack(pady=20)
    
    status_label = tk.Label(frame, text="", font=("Arial", 9))
    status_label.pack(pady=5)
    
    root.mainloop()

def merge_and_show_result(root):
    """
    Performs the merge operation and displays the result in a messagebox.
    """
    success, file_count, output_path = merge_pdfs()
    if success:
        messagebox.showinfo("Success", f"Successfully merged {file_count} PDFs into:\n{output_path}")
    else:
        messagebox.showinfo("Information", "PDF merging was cancelled or failed.")

if __name__ == "__main__":
    main()