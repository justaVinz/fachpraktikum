from mtcnn import MTCNN
import numpy as np
import cv2
from sklearn.preprocessing import Normalizer
from sklearn.metrics.pairwise import cosine_similarity
from keras_facenet import FaceNet

class Helpers:
    def __init__(self):
        self.detector = MTCNN()
        self.facenet = FaceNet()
        self.normalizer = Normalizer('l2')

    def load_known_face(self, image):
        faces = self.detector.detect_faces(image)
        if not faces:
            print("Kein Gesicht im bekannten Bild gefunden.")
            return None

        x, y, width, height = faces[0]['box']
        face = image[y:y+height, x:x+width]
        face = cv2.resize(face, (160, 160))
        face = np.expand_dims(face, axis=0)
        embedding = self.facenet.embeddings(face)
        embedding = self.normalizer.transform(embedding)
        return embedding

    def recognize_face(self, embedding, known_embeddings, known_labels, threshold=0.65):
        embedding = np.array(embedding).reshape(1, -1)
        known_embeddings = np.array(known_embeddings).reshape(1, -1)
        similarities = cosine_similarity(embedding, known_embeddings)
        print(f"Similarities: {similarities}")
        max_similarity = np.max(similarities)
        label = known_labels[np.argmax(similarities)]
        if max_similarity > threshold:
            return label, max_similarity
        else:
            return "Unbekannt", max_similarity