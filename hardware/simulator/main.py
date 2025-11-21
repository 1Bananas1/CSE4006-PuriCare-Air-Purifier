import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('server\src\api\cse4006-c9446422bcd5.json')
firebase_admin.initialize_app(cred)
db = firestore.client()