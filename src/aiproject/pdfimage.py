from tkinter import filedialog as fd, Tk, Label, Button, messagebox
from pdf2image import convert_from_path
import os

def pdf2img():
    filename = fd.askopenfilename(title="Select a PDF file", filetypes=[("PDF files", "*.pdf")])
    
    if not filename:
        messagebox.showerror("Error", "No file selected.")
        return

    try:
        images = convert_from_path(filename, dpi=200, poppler_path=r"C:\poppler-24.08.0\Library\bin")
        
        output_folder = os.path.dirname(filename)  # Save images in the same folder as the PDF
        for i, image in enumerate(images):
            fname = os.path.join(output_folder, f'image_{i + 1}.png')
            image.save(fname, "PNG")

        messagebox.showinfo("Success", f"Images saved successfully in {output_folder}")
    
    except FileNotFoundError:
        messagebox.showerror("Error", "Poppler not found. Ensure it's installed and in the PATH.")
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred: {e}")

master = Tk()
master.title("PDF to Image Converter")

Label(master, text="Click below to select a PDF and convert it to images:").grid(row=0, column=0, sticky='W', padx=10, pady=10)

b = Button(master, text="Convert", command=pdf2img)
b.grid(row=1, column=0, padx=10, pady=10)

master.mainloop()
