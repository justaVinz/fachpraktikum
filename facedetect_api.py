import os.path

import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition

app = Flask(__name__)
path = "./photo/"
img_name = "img.png"

if __name__ == '__main__':
    CORS(app)

@app.route('/capture', methods=['POST'])
def capture():
    img_path = os.path.join(path, img_name)
    img = cv2.imread(img_path)
    camera = cv2.VideoCapture(0)

    if img is None:
        print("Kein Bild vorhanden, nehme Bild auf...")

        if not camera.isOpened():
            return jsonify({"error": "Kamera konnte nicht geöffnet werden."}), 500

        ret, frame = camera.read()
        if not ret:
            return jsonify({"error": "Fehler beim Lesen des Frames."}), 500

        cv2.imwrite(path + img_name, frame)
        print(f"Bild gespeichert unter {path}img.png")

        camera.release()

        return jsonify({"message": "Bild wurde aufgenommen und gespeichert.", "img_path": "./photo/img.png"})
    else:
        return jsonify({"message": "Bild bereits vorhanden."})

@app.route('/detect', methods=['POST'])
def detect():
    recognized = False
    control_image = cv2.imread(path + img_name)

    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        print("Fehler: Kamera konnte nicht geöffnet werden.")

    ret, frame = camera.read()
    if not ret:
        print("Fehler beim Lesen des Kamera-Frames.")
        exit(1)

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    control_rgb = cv2.cvtColor(control_image, cv2.COLOR_BGR2RGB)
    frame_face_encodings = face_recognition.face_encodings(frame_rgb)
    control_face_encodings = face_recognition.face_encodings(control_rgb)

    if len(frame_face_encodings) == 1:
        face_match = face_recognition.compare_faces(control_face_encodings, frame_face_encodings[0])
        if any(face_match):
            recognized = True

    if recognized:
        return jsonify({"message": "Gesicht erkannt", "recognized": True }), 200

    camera.release()
    cv2.destroyAllWindows()
    return jsonify({"message": "Gesicht nicht erkannt oder nicht übereinstimmend.", "recognized": False}), 200
