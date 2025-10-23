import requests
import base64
import json
import io
import re 
from PIL import Image

def slugify(s):
    s = s.lower().strip()
    s = re.sub(r'[^\w\s-]', '-', s)
    s = re.sub(r'[\s_-]+', '-', s)
    s = re.sub(r'^-+|-+$', '', s)
    return s

# GMT file from https://download.baderlab.org/PathwayCommons/PC2/v14/
pc_gmt_file = "pc-hgnc.gmt"
config_path = "config.json"
sybvals_url = 'http://localhost:3400/validation'

pc_gmt = open(pc_gmt_file, 'r')
lines = pc_gmt.readlines()

for i in range(1, 4667):
    tmp = lines[i].split('\t', 1)
    pathway_id = tmp[0]

    # only process pathways with identifier url
    if not pathway_id.startswith("http"):
        continue

    print(f'I: {str(i)}; Pathway: {pathway_id}')

    output_file_slug = slugify(pathway_id)

    sbgn_path = f'Batch/{output_file_slug}.sbgn'
    error_path = f'Batch/{output_file_slug}.txt'
    png_path = f'Batch/{output_file_slug}.png'
    result_path = "result.txt"

    pc_url = f'https://www.pathwaycommons.org/pc2/get?uri={pathway_id}&format=SBGN'

    r = requests.get(pc_url, allow_redirects=True)
    s = r.content
    open(sbgn_path, 'wb').write(s)

    with open(sbgn_path, 'r') as f:
        data_sbgn = f.read()

    with open(config_path, 'r') as f:
        options = f.read()

    data = data_sbgn + options

    headers = {"Content-Type": "text/plain"}

    res = requests.post(sybvals_url, headers=headers, data=data)

    print(res.status_code)

    tmp = json.loads(res.text)

    data_base64 = tmp['image']

    with open(error_path, "w") as f:
        if len(tmp["errors"]) == 0:
            f.write("Map is valid")
        else:
            json_string = json.dumps(tmp['errors'], indent=4)
            f.write(json_string)

    with open(result_path, "a") as f:
        if len(tmp["errors"]) == 0:
            f.write(pathway_id + " Map is valid\n")
        else:
            f.write(pathway_id + " Map is not valid\n")

    im = Image.open(io.BytesIO(base64.b64decode(data_base64.split(',')[1])))
    im.save(png_path) 
 


