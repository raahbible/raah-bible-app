from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
import re

app = Flask(__name__)
CORS(app)

# API.Bible configuration
API_BIBLE_KEY = os.environ.get('API_BIBLE_KEY', 'ca56e24888f236ff3c57091e1c258196')
API_BIBLE_BASE = 'https://api.scripture.api.bible/v1'

headers = {
    'api-key': API_BIBLE_KEY
}

# Preferred versions and languages
PREFERRED_VERSIONS = []
PREFERRED_LANGUAGES = ['eng', 'ibo', 'yor', 'hau', 'ara', 'mlg', 'heb', 'amh', 'fra', 'spa', 'cmn', 'zho']

def clean_verse_text(text):
    """Remove HTML tags and extra whitespace from verse text"""
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "Raah Bible API is running"})

@app.route('/api/versions')
def get_versions():
    """Get available Bible versions"""
    try:
        response = requests.get(f'{API_BIBLE_BASE}/bibles', headers=headers)
        response.raise_for_status()
        data = response.json()
        
        bibles = data.get('data', [])
        
        filtered_bibles = []
        for bible in bibles:
            if bible['id'] in PREFERRED_VERSIONS or bible['language']['id'] in PREFERRED_LANGUAGES:
                filtered_bibles.append({
                    'id': bible['id'],
                    'name': bible['name'],
                    'abbreviation': bible['abbreviation'],
                    'language': bible['language']['name']
                })
        
        filtered_bibles.sort(key=lambda x: (
            PREFERRED_VERSIONS.index(x['id']) if x['id'] in PREFERRED_VERSIONS else 999,
            x['name']
        ))
        
        return jsonify(filtered_bibles[:50])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/versions/<version_id>/books')
def get_books(version_id):
    """Get books for a specific Bible version"""
    try:
        response = requests.get(
            f'{API_BIBLE_BASE}/bibles/{version_id}/books',
            headers=headers
        )
        response.raise_for_status()
        data = response.json()
        
        books = []
        for book in data.get('data', []):
            book_detail = {
                'id': book['id'],
                'name': book['name'],
                'abbreviation': book.get('abbreviation', ''),
                'chapters': []
            }
            
            try:
                chapters_response = requests.get(
                    f'{API_BIBLE_BASE}/bibles/{version_id}/books/{book["id"]}/chapters',
                    headers=headers
                )
                if chapters_response.status_code == 200:
                    chapters_data = chapters_response.json()
                    book_detail['chapters'] = [
                        {'id': ch['id'], 'number': ch.get('number', '')}
                        for ch in chapters_data.get('data', [])
                        if ch.get('number', '').isdigit()
                    ]
            except:
                pass
            
            books.append(book_detail)
        
        return jsonify(books)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare', methods=['POST'])
def compare_verses():
    """Compare verses across multiple Bible versions"""
    try:
        data = request.json
        version_ids = data.get('version_ids', [])
        book_id = data.get('book_id')
        chapter = data.get('chapter', 1)
        
        if not version_ids or not book_id:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        verses_by_version = {}
        book_name = ""
        
        for version_id in version_ids:
            try:
                chapter_id = f'{book_id}.{chapter}'
                
                response = requests.get(
                    f'{API_BIBLE_BASE}/bibles/{version_id}/chapters/{chapter_id}/verses',
                    headers=headers
                )
                
                if response.status_code == 200:
                    verses_data = response.json()
                    verses_by_version[version_id] = {}
                    
                    for verse in verses_data.get('data', []):
                        verse_num = verse.get('number', verse.get('id', '').split('.')[-1])
                        verse_text = clean_verse_text(verse.get('text', ''))
                        verses_by_version[version_id][verse_num] = verse_text
                        
                        if not book_name and 'reference' in verse:
                            book_name = verse['reference'].split()[0]
            except Exception as e:
                print(f"Error fetching verses for version {version_id}: {e}")
                verses_by_version[version_id] = {}
        
        all_verse_numbers = set()
        for version_verses in verses_by_version.values():
            all_verse_numbers.update(version_verses.keys())
        
        sorted_verses = sorted(all_verse_numbers, key=lambda x: int(x) if str(x).isdigit() else 999)
        
        comparison = {
            'book_id': book_id,
            'book_name': book_name or book_id.split('.')[0].upper(),
            'chapter': chapter,
            'verses': []
        }
        
        for verse_num in sorted_verses:
            verse_data = {
                'verse': verse_num,
                'texts': {}
            }
            
            for version_id in version_ids:
                verse_data['texts'][version_id] = verses_by_version.get(version_id, {}).get(
                    verse_num, 'Verse not available'
                )
            
            comparison['verses'].append(verse_data)
        
        return jsonify(comparison)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
