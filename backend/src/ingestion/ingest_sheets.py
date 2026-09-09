import sys
import os
import urllib.request
import urllib.parse
import json
import re
import hashlib
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data'))
if not os.path.exists(DATA_DIR):
    DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data'))
os.makedirs(DATA_DIR, exist_ok=True)

ADS_FILE = os.path.join(DATA_DIR, 'ads.json')
SYNC_STATUS_FILE = os.path.join(DATA_DIR, 'sync_status.json')
XLSX_CACHE_FILE = os.path.join(DATA_DIR, 'source_cache.xlsx')

DEFAULT_SHEET_ID = '1tZxJhQufqVprwcZeUgeu6MBgsxJbHXWXPdz_DQmVejc'

FIELD_SYNONYMS = {
    'creative_url': [
        r'\bimage\s*/\s*video\s*/\s*creative\s*link\b', r'\bcreative\s*link\b', r'\bcreative\s*url\b',
        r'\bimage\s*url\b', r'\bvideo\s*url\b', r'\bmedia\s*link\b'
    ],
    'creative_type': [
        r'\bcreative\s*type\b', r'\bad\s*format\b', r'\bcontent\s*type\b', r'\bformat\b'
    ],
    'brand': [
        r'\bcompany\b', r'\badvertiser\s*/\s*brand\b', r'\badvertiser\s*/\s*account\b',
        r'\badvertiser\b', r'\bbrand\b', r'\bpaid\s*for\s*by\b'
    ],
    'title': [
        r'\bad\s*headline\b', r'\btitle\s*/\s*hook\b', r'\bheadline\b', r'\btitle\b', r'\bhook\b'
    ],
    'summary': [
        r'\bad\s*summary\b', r'\bwhat\s*the\s*reel\s*is\s*about\b', r'\breel\s*content\s*summary\b',
        r'\bsummary\b', r'\bdescription\b'
    ],
    'ad_copy': [
        r'\bprimary\s*ad\s*text\s*/\s*caption\b', r'\bcaption\b', r'\bad\s*copy\b', r'\bad\s*text\b',
        r'\bcopy\b', r'\bbody\b'
    ],
    'landing_page_url': [
        r'\bad\s*/\s*landing\s*page\s*link\b', r'\blanding\s*page\s*link\b', r'\blanding\s*page\b',
        r'\bdestination\s*url\b', r'\btarget\s*url\b'
    ],
    'source_ad_url': [
        r'\bad\s*link\b', r'\breel\s*link\b', r'\bmeta\s*ad\s*library\s*link\b',
        r'\bsource\s*/\s*google\s*ads\s*transparency\s*link\b', r'\btransparency\s*link\b',
        r'\bsource\s*link\b', r'\boriginal\s*link\b'
    ],
    'category': [
        r'\bcategory\s*of\s*ad\b', r'\bcategory\b', r'\bsubcategory\b', r'\bindustry\b'
    ],
    'topics': [
        r'\bkeywords\s*/\s*topics\b', r'\bkey\s*topics\b', r'\btopics\b', r'\bkeywords\b', r'\btags\b'
    ],
    'hashtags': [
        r'\bhashtags\b', r'\bhashtag\b'
    ],
    'cta': [
        r'\bcta\b', r'\bcall\s*to\s*action\b', r'\bbutton\b'
    ],
    'views': [r'\bviews\b'],
    'likes': [r'\blikes\b'],
    'comments': [r'\bcomments\b'],
    'additional': [
        r'\badditional\s*ad\s*details\b', r'\bimportant\s*observations\b',
        r'\bmeta\s*ad\s*id\b', r'\badditional\s*ad\s*information\b', r'\bverification\s*notes\b'
    ]
}

def clean_text(val):
    if val is None:
        return ''
    return str(val).strip()

def extract_hyperlink(formula_str, fallback_val=''):
    if not formula_str:
        val = clean_text(fallback_val)
        if val.startswith('http://') or val.startswith('https://'):
            return val, val
        return '', val
    m = re.search(r'HYPERLINK\s*\(\s*["\']([^"\']+)["\']\s*(?:,\s*["\']([^"\']*)["\'])?\s*\)', formula_str, re.I)
    if m:
        url = m.group(1).strip()
        label = m.group(2).strip() if m.group(2) else fallback_val
        return url, label
    val = clean_text(formula_str)
    if val.startswith('http://') or val.startswith('https://'):
        return val, fallback_val
    return '', fallback_val

def clean_brand(brand_raw, landing_page=''):
    b = clean_text(brand_raw)
    b_clean = re.sub(r'\s*\(@[a-zA-Z0-9_.]+\)', '', b)
    b_clean = re.sub(r',\s*(?:Inc\.?|LLC|GmbH|s\.r\.o\.|SRL|ApS|COMPANY LIMITED)\b', '', b_clean, flags=re.I).strip()
    b_clean = re.sub(r'\s+(?:Inc\.?|LLC|GmbH|s\.r\.o\.|SRL|ApS)\b', '', b_clean, flags=re.I).strip()
    b_clean = re.sub(r'\s+with\s+[a-zA-Z0-9_]+', '', b_clean, flags=re.I).strip()

    b_lower = b_clean.lower()
    lp_lower = clean_text(landing_page).lower()

    if 'semrush' in b_lower or 'semrush' in lp_lower:
        return 'Semrush'
    if 'peec' in b_lower or 'peec' in lp_lower:
        return 'Peec AI'
    if 'otterly' in b_lower or 'otterly' in lp_lower:
        return 'Otterly AI'
    if 'profound' in b_lower or 'cooper square' in b_lower or 'tryprofound' in lp_lower:
        return 'Profound'
    if 'rankscale' in b_lower or 'rank scale' in b_lower or 'rankscale' in lp_lower:
        return 'Rankscale'
    if 'digital funda' in b_lower:
        return 'Digital Funda'
    if 'codecat' in b_lower or 'codecat' in lp_lower:
        return 'CodeCat'
    if 'nuvotech' in b_lower or 'nuvotech' in lp_lower:
        return 'NuvoTech'
    if 'etarg' in b_lower or 'etarg' in lp_lower:
        return 'eTarg Media'
    if 'hyperfavor' in b_lower or 'hyperfavor' in lp_lower:
        return 'Hyperfavor'
    if 'zentravyx' in b_lower:
        return 'Zentravyx'
    if 'hera seo' in b_lower:
        return 'Hera SEO'
    if 'athenahq' in b_lower or 'athenahq' in lp_lower:
        return 'AthenaHQ'
    if 'mangools' in b_lower or 'mangools' in lp_lower:
        return 'Mangools'
    if 'scrunch' in b_lower or 'scrunch' in lp_lower:
        return 'Scrunch'
    if 'accuranker' in b_lower or 'accuranker' in lp_lower:
        return 'AccuRanker'
    if 'excelsa' in b_lower:
        return 'Excelsa Labs'
    return b_clean if b_clean else 'Other'

def parse_topics(topics_str):
    if not topics_str or str(topics_str).lower() in ['none', 'no topics', 'n/a', 'nan']:
        return []
    parts = re.split(r'[,|;]+', str(topics_str))
    res = []
    for p in parts:
        item = p.strip()
        if item and len(item) > 1 and item.lower() not in ['no topics', 'none', 'n/a', 'nan']:
            res.append(item)
    return res

def parse_hashtags(tag_str):
    if not tag_str or str(tag_str).lower() in ['no hashtags', 'none', 'n/a', 'nan']:
        return []
    tags = re.findall(r'#([a-zA-Z0-9_]+)', str(tag_str))
    if not tags:
        parts = re.split(r'[,|\s]+', str(tag_str))
        for p in parts:
            p = p.strip().lstrip('#')
            if p and len(p) > 1 and p.lower() not in ['no hashtags', 'none']:
                tags.append(p)
    return list(set(tags))

def generate_concepts(brand, title, summary, copy, category, topics, hashtags):
    tokens = set()
    text = f"{brand} {title} {summary} {copy} {category} {' '.join(topics)} {' '.join(hashtags)}".lower()
    
    concept_map = {
        'ai search': ['ai search', 'answer engine', 'generative engine', 'chatgpt search', 'perplexity', 'gemini citation', 'llm search'],
        'aeo': ['aeo', 'answer engine optimization', 'llm optimization', 'prompt tracking', 'brand visibility in ai', 'brand visibility'],
        'geo': ['geo', 'generative engine optimization', 'generative ai optimization', 'ai visibility'],
        'seo': ['seo', 'search engine optimization', 'keyword tracking', 'backlinks', 'organic search', 'rank tracker', 'serp'],
        'video': ['video', 'reel', 'motion ad', 'short form video', 'video ad', 'screen recording'],
        'autonomous ai': ['autonomous agent', 'ai agent', 'background agent', 'ai marketer', 'autonomous marketing'],
        'lead generation': ['lead gen', 'lead generation', 'whitepaper', 'b2b lead', 'demo', 'consultation'],
        'b2b': ['b2b', 'enterprise', 'saas', 'workflow', 'gtm', 'go to market', 'b2b marketing'],
        'pricing': ['pricing', 'subscription', 'free trial', 'plan', 'discount', 'tier', 'per month'],
        'case study': ['case study', 'roi', 'increased visibility', 'customer story', 'success story', 'mongodb'],
        'carousel': ['carousel', 'document ad', 'slide deck', 'pdf ad', 'multi-image'],
        'influencer & ugc': ['ugc', 'creator', 'founder-led', 'testimonial', 'influencer'],
        'social proof': ['reviews', 'ratings', 'recommendations', 'top ranked', 'industry report', 'benchmark']
    }
    
    for concept, keywords in concept_map.items():
        for kw in keywords:
            if kw in text:
                tokens.add(concept)
                tokens.add(kw)
                break
                
    for t in topics:
        tokens.add(t.lower())
    for h in hashtags:
        tokens.add(h.lower())
        
    return list(tokens)

def detect_platform_from_tab_or_data(tab_name):
    tab_lower = tab_name.lower()
    if 'google' in tab_lower:
        return 'Google Ads'
    if 'meta' in tab_lower or 'facebook' in tab_lower:
        return 'Meta Ads'
    if 'insta' in tab_lower or 'reel' in tab_lower:
        return 'Instagram tagged'
    if 'linkedin' in tab_lower:
        return 'LinkedIn'
    if 'tiktok' in tab_lower:
        return 'TikTok'
    if 'youtube' in tab_lower:
        return 'YouTube'
    return 'Digital Ads'

def map_headers_to_fields(header_row):
    mapping = {}
    for col_idx, raw_header in enumerate(header_row):
        h = clean_text(raw_header).lower()
        if not h:
            continue
        for field, patterns in FIELD_SYNONYMS.items():
            if field in mapping:
                continue
            for pat in patterns:
                if re.search(pat, h):
                    mapping[field] = col_idx
                    break
    return mapping

def col_letter_to_index(col_str):
    num = 0
    for c in col_str:
        num = num * 26 + (ord(c.upper()) - ord('A')) + 1
    return num - 1

def ingest_from_xlsx(sheet_id=DEFAULT_SHEET_ID):
    xlsx_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    print(f"Connecting to Google Sheet: {sheet_id}...")
    
    try:
        req = urllib.request.Request(xlsx_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            with open(XLSX_CACHE_FILE, 'wb') as f:
                f.write(data)
            print(f"Downloaded fresh XLSX: {len(data)} bytes")
    except Exception as e:
        print(f"Fetch note: {e}. Checking local cache...")
        if not os.path.exists(XLSX_CACHE_FILE):
            raise Exception(f"No local cache and cannot download sheet: {e}")

    with zipfile.ZipFile(XLSX_CACHE_FILE, 'r') as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            for si in ss_root.findall('.//main:si', ns):
                text_elems = si.findall('.//main:t', ns)
                shared_strings.append(''.join([t.text or '' for t in text_elems]))

        wb_root = ET.fromstring(z.read('xl/workbook.xml'))
        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        sheets_info = []
        for s in wb_root.findall('.//main:sheet', ns):
            sheets_info.append({
                'name': s.attrib.get('name'),
                'sheetId': s.attrib.get('sheetId'),
                'rId': s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            })
        
        wb_rels_root = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rel_map = {r.attrib['Id']: r.attrib['Target'] for r in wb_rels_root}
        for s in sheets_info:
            target = rel_map.get(s['rId'], f"worksheets/sheet{s['sheetId']}.xml")
            if not target.startswith('xl/'):
                target = 'xl/' + target
            s['xml_path'] = target

        canonical_ads = []

        for s in sheets_info:
            tab_name = s['name']
            xml_path = s['xml_path']
            if xml_path not in z.namelist():
                continue

            sheet_root = ET.fromstring(z.read(xml_path))
            rows_data = []
            
            for row_el in sheet_root.findall('.//main:row', ns):
                cells_dict = {}
                for c_el in row_el.findall('.//main:c', ns):
                    r_coord = c_el.attrib.get('r', '')
                    m = re.match(r'([A-Z]+)(\d+)', r_coord)
                    if not m:
                        continue
                    col_idx = col_letter_to_index(m.group(1))
                    
                    t_attr = c_el.attrib.get('t', '')
                    f_el = c_el.find('main:f', ns)
                    formula = f_el.text if f_el is not None else None
                    v_el = c_el.find('main:v', ns)
                    raw_v = v_el.text if v_el is not None else None
                    
                    val_str = ''
                    if t_attr == 's' and raw_v is not None and raw_v.isdigit():
                        idx = int(raw_v)
                        if idx < len(shared_strings):
                            val_str = shared_strings[idx]
                    elif raw_v is not None:
                        val_str = raw_v
                        
                    cells_dict[col_idx] = {'val': val_str, 'formula': formula}
                
                if cells_dict:
                    max_col = max(cells_dict.keys())
                    row_list = [cells_dict.get(ci, {'val': '', 'formula': None}) for ci in range(max_col + 1)]
                    if any(c['val'].strip() or (c['formula'] and c['formula'].strip()) for c in row_list):
                        rows_data.append(row_list)

            if not rows_data:
                continue

            # Header row detection: find first row with at least 3 labeled columns
            header_idx = 0
            for r_i, r_cells in enumerate(rows_data[:5]):
                non_empty = [clean_text(c['val']) for c in r_cells if clean_text(c['val'])]
                if len(non_empty) >= 3:
                    header_idx = r_i
                    break

            header_row = [clean_text(c['val']) for c in rows_data[header_idx]]
            data_rows = rows_data[header_idx + 1:]
            field_map = map_headers_to_fields(header_row)
            
            print(f"\nTab '{tab_name}': {len(data_rows)} raw rows. Field mapping: {field_map}")

            platform_default = detect_platform_from_tab_or_data(tab_name)

            for r in data_rows:
                # Filter out divider or empty rows (where fewer than 2 fields have content)
                filled_cells = [c['val'].strip() for c in r if c['val'].strip()]
                if len(filled_cells) < 2:
                    continue

                raw_row = {}
                for ci, col_cell in enumerate(r):
                    col_name = header_row[ci] if ci < len(header_row) and header_row[ci] else f"Col_{ci}"
                    val = col_cell['val']
                    if col_cell['formula']:
                        url, label = extract_hyperlink(col_cell['formula'], val)
                        val = url if url else (label if label else val)
                    raw_row[col_name] = val

                def get_cell(field_key):
                    if field_key in field_map:
                        idx = field_map[field_key]
                        if idx < len(r):
                            return r[idx]
                    return {'val': '', 'formula': None}

                def get_val(field_key):
                    c = get_cell(field_key)
                    return clean_text(c['val'])

                def get_url(field_key):
                    c = get_cell(field_key)
                    url, _ = extract_hyperlink(c['formula'], c['val'])
                    return clean_text(url)

                landing_page_url = get_url('landing_page_url')
                source_ad_url = get_url('source_ad_url')
                category = get_val('category') or 'General'

                # Filter out research placeholder rows like "Not found"
                if category == 'Not found' and not landing_page_url and not source_ad_url:
                    continue

                brand_raw = get_val('brand')
                brand = clean_brand(brand_raw, landing_page_url)
                title = get_val('title')
                if title.lower() in ['no explicit headline', 'no headline']:
                    title = ''
                summary = get_val('summary')
                ad_copy = get_val('ad_copy')
                creative_type = get_val('creative_type') or 'Ad'
                
                creative_url = get_url('creative_url')

                if not creative_url and source_ad_url and ('instagram.com' in source_ad_url or 'licdn.com' in source_ad_url):
                    creative_url = source_ad_url

                cta = get_val('cta')
                if cta.lower() in ['no explicit cta', 'none']:
                    cta = ''

                topics = parse_topics(get_val('topics'))
                hashtags = parse_hashtags(get_val('hashtags'))
                
                views = get_val('views')
                likes = get_val('likes')
                comments = get_val('comments')
                metrics = {}
                if views: metrics['views'] = views
                if likes: metrics['likes'] = likes
                if comments: metrics['comments'] = comments

                additional = get_val('additional')

                # Extract Format or CTA from Additional info if present (e.g. Meta Ads)
                if additional and 'Format:' in additional:
                    fmt_match = re.search(r'Format:\s*([^|]+)', additional)
                    if fmt_match and creative_type == 'Ad':
                        creative_type = fmt_match.group(1).strip()
                if additional and 'CTA:' in additional and not cta:
                    cta_match = re.search(r'CTA:\s*([^|]+)', additional)
                    if cta_match:
                        cta = cta_match.group(1).strip()

                # Fallback titles and summaries
                if not summary and ad_copy:
                    summary = ad_copy[:160]
                if not title and summary:
                    title = summary[:90]
                if not ad_copy and summary:
                    ad_copy = summary
                if not category and topics:
                    category = topics[0]

                # Fingerprint
                fp_data = f"{platform_default}|{brand}|{title}|{landing_page_url}|{source_ad_url}|{creative_url}|{summary[:100]}"
                fingerprint = hashlib.sha256(fp_data.encode('utf-8')).hexdigest()
                ad_id = f"ad_{fingerprint[:16]}"

                search_concepts = generate_concepts(brand, title, summary, ad_copy, category, topics, hashtags)
                search_doc_parts = [
                    f"Brand: {brand} {brand_raw}",
                    f"Platform: {platform_default}",
                    f"Title: {title}",
                    f"Headline: {title}",
                    f"Summary: {summary}",
                    f"Copy: {ad_copy}",
                    f"Category: {category}",
                    f"Format: {creative_type}",
                    f"CTA: {cta}",
                    f"Topics: {' '.join(topics)}",
                    f"Hashtags: {' '.join(hashtags)}",
                    f"Concepts: {' '.join(search_concepts)}"
                ]
                search_document = ' \n'.join(search_doc_parts)

                ad = {
                    'id': ad_id,
                    'sourceSheetId': sheet_id,
                    'sourceTab': tab_name,
                    'platform': platform_default,
                    'brand': brand,
                    'advertiserRaw': brand_raw,
                    'title': title,
                    'summary': summary,
                    'adCopy': ad_copy,
                    'category': category,
                    'creativeType': creative_type,
                    'creativeUrl': creative_url,
                    'thumbnailUrl': creative_url,
                    'landingPageUrl': landing_page_url,
                    'sourceAdUrl': source_ad_url,
                    'cta': cta,
                    'hashtags': hashtags,
                    'topics': topics,
                    'metrics': metrics,
                    'additionalDetails': additional,
                    'rawRowData': raw_row,
                    'searchDocument': search_document,
                    'searchConcepts': search_concepts,
                    'fingerprint': fingerprint,
                    'createdAt': '2026-09-09T00:00:00Z',
                    'updatedAt': '2026-09-09T00:00:00Z'
                }
                canonical_ads.append(ad)

    print(f"\n==========================================")
    print(f"Total Valid Canonical Ads Processed: {len(canonical_ads)}")
    
    with open(ADS_FILE, 'w', encoding='utf-8') as f:
        json.dump(canonical_ads, f, ensure_ascii=False)
    print(f"Saved canonical database to: {ADS_FILE}")

    sync_status = {
        'isSyncing': False,
        'currentStage': 'Ready',
        'progressPercent': 100,
        'lastSyncedAt': '2026-09-09T13:00:00Z',
        'recordsCount': len(canonical_ads),
        'newAdsCount': len(canonical_ads),
        'updatedAdsCount': 0,
        'unchangedAdsCount': 0,
        'deletedAdsCount': 0,
        'tabsProcessed': [s['name'] for s in sheets_info]
    }
    with open(SYNC_STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(sync_status, f, indent=2)

    return canonical_ads

if __name__ == '__main__':
    ingest_from_xlsx()
