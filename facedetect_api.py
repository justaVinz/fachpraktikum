import cv2
import sys
import numpy as np
from flask import Flask, request, jsonify
from helpers import Helpers

app = Flask(__name__)
path = "./photo/"
img_name = "2persons.png"
helpers = Helpers()

if __name__ == '__main__':
    app.run(debug=True)
@app.route('/capture', methods=['POST'])
def capture():
    img = cv2.imread(path + img_name)
    camera = cv2.VideoCapture(0)

    if img is None:
        print("Kein Bild vorhanden, nehme Bild auf...")

        if not camera.isOpened():
            return jsonify({"error": "Kamera konnte nicht geöffnet werden."}), 500

        ret, frame = camera.read()
        if not ret:
            return jsonify({"error": "Fehler beim Lesen des Frames."}), 500

        cv2.imwrite(path + img_name, frame)
        print(f"Bild gespeichert unter {path}2persons.png")

        camera.release()

        return jsonify({"message": "Bild wurde aufgenommen und gespeichert.", "image_path": "/photo/2persons.png"})
    else:
        return jsonify({"message": "Bild bereits vorhanden."})

@app.route('/detect', methods=['POST'])
def detect():
    control_image = cv2.imread(path + img_name)
    control_embedding = helpers.load_known_face(control_image)

    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        print("Fehler: Kamera konnte nicht geöffnet werden.")

    ret, frame = camera.read()
    if not ret:
        print("Fehler beim Lesen des Kamera-Frames.")
        exit(1)

    faces = helpers.detector.detect_faces(frame)
    print(len(faces))
    detected_faces = 0

    isRecognized = False

    for face in faces:
        x, y, width, height = face['box']
        face_img = frame[y:y + height, x:x + width]
        face_img = cv2.resize(face_img, (160, 160))
        face_img = np.expand_dims(face_img, axis=0)

        embedding = helpers.facenet.embeddings(face_img)
        embedding = helpers.normalizer.transform(embedding)
        print(embedding.shape)
        label, _ = helpers.recognize_face(embedding, [control_embedding], ["control person"])

        if label == "control person":
            isRecognized = True
            detected_faces += 1

        if detected_faces > 1:
            isRecognized = False
            return jsonify({"message": "Kontrollperson nicht alleine im Bild"})

        camera.release()
        cv2.destroyAllWindows()
        return jsonify({"message": "Nur Kontrollperson erkannt."})
