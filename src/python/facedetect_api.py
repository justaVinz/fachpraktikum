import os
import time

import cv2
from pathlib import Path
from flask import Flask, jsonify
from flask_cors import CORS
import face_recognition
from PIL import Image, ImageDraw

app = Flask(__name__)
CORS(app)  # Enable CORS if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
photos_dir = os.path.join(parent_dir, 'app/lib/photos')

"""
    Captures an image from the webcam and saves it as a PNG file.

    Parameters:
    user_id (str): The unique identifier for the user. This is used to name the saved image file.

    Returns:
    dict: A JSON response with a message indicating the outcome of the capture process.
          If an error occurs, the response will contain an 'error' key with a description of the error.
          If the capture is successful, the response will contain an 'img_path' key with the path to the saved image file.
    """
@app.route('/capture/<user_id>', methods=['POST'])
def capture(user_id):
    img_name = f"{user_id}.png"
    img_path = os.path.join(photos_dir, img_name)
    img = cv2.imread(img_path)
    camera = cv2.VideoCapture(0)
    time.sleep(2)

    if img is None:
        print("Kein Bild vorhanden, nehme Bild auf...")

        if not camera.isOpened():
            return jsonify({"error": "Kamera konnte nicht geöffnet werden."}), 500

        ret, frame = camera.read()
        if not ret:
            return jsonify({"error": "Fehler beim Lesen des Frames."}), 500

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(frame_rgb, model="cnn")
        print(len(face_locations))

        if len(face_locations) > 1:
            return jsonify({"error": "Mehrere Personen in der Kamera-Aufzeichnung."}), 400

        cv2.imwrite(img_path, frame)
        print(f"Bild gespeichert unter {img_path}")

        camera.release()

        json_string = { "message": "Bild wurde aufgenommen und gespeichert.", "img_path": img_path }
        return jsonify(json_string)
    else:
        return jsonify({"message": "Bild bereits vorhanden."})


"""
    Detects a face in a live video stream from the webcam and compares it with a control image.

    Parameters:
    user_id (str): The unique identifier for the user. This is used to name the control image file.

    Returns:
    dict: A JSON response with a message indicating the outcome of the detection process.
          If an error occurs, the response will contain an 'error' key with a description of the error.
          If the detection is successful, the response will contain a 'recognized' key indicating whether the face was recognized.
    """
@app.route('/detect/<user_id>', methods=['POST'])
def detect(user_id):
    img_name = f"{user_id}.png"
    img_path = os.path.join(photos_dir, img_name)
    recognized = False
    control_image = cv2.imread(img_path)

    if control_image is None:
        return jsonify({"error": "Kontrollbild nicht gefunden."}), 404

    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        return jsonify({"error": "Kamera konnte nicht geöffnet werden."}), 500

    ret, frame = camera.read()
    if not ret:
        return jsonify({"error": "Fehler beim Lesen des Kamera-Frames."}), 500

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    control_rgb = cv2.cvtColor(control_image, cv2.COLOR_BGR2RGB)
    frame_face_locations = face_recognition.face_locations(frame_rgb, model="cnn")
    frame_face_encodings = face_recognition.face_encodings(frame_rgb, known_face_locations=frame_face_locations)
    control_face_locations = face_recognition.face_locations(control_rgb, model="cnn")
    control_face_encodings = face_recognition.face_encodings(control_rgb, known_face_locations=control_face_locations)

    if len(frame_face_locations) == 1 and len(control_face_locations) == 1:
        face_match = face_recognition.compare_faces(control_face_encodings, frame_face_encodings[0])
        if any(face_match):
            recognized = True

    camera.release()
    cv2.destroyAllWindows()

    if recognized:
        print("Gesichter sind identisch")
        return jsonify({"message": "Gesichter sind identisch", "recognized": True}), 200
    else:
        print("Gesichter sind nicht identisch")
        return jsonify({"message": "Gesichter sind nicht indentisch.", "recognized": False}), 200

"""
    Checks if an image file exists for a given user.

    Parameters:
    user_id (str): The unique identifier for the user. This is used to name the image file.

    Returns:
    dict: A JSON response with a message indicating the existence of the image file.
          If the image file exists, the response will contain an 'exists' key with a value of True.
          If the image file does not exist, the response will contain an 'exists' key with a value of False.
"""
@app.route('/check/<user_id>', methods=['GET'])
def check_image(user_id):
    img_name = f"{user_id}.png"
    img_path = os.path.join(photos_dir, img_name)

    if os.path.isfile(img_path):
        return jsonify({"message": "Bild existiert.", "exists": True}), 200
    else:
        return jsonify({"message": "Bild existiert nicht.", "exists": False}), 404


if __name__ == '__main__':
    app.run(debug=True)
