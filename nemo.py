import json
import os
from NeMo.collections.asr.models import ClusteringDiarizer
from omegaconf import OmegaConf

input_file = '/path/to/audio.wav' # Note : The file needs to be mono .wav
meta = {
            'audio_filepath': input_file,
            'offset': 0,
            'duration':None,
            'label': 'infer',
            'text': '-',
            'num_speakers': 7,
            'rttm_filepath': None, # You can add a reference file here
            'uem_filepath' : None
        }
with open('../data/input_manifest.json','w') as fp:
    json.dump(meta,fp)
    fp.write('\n')
output_dir = os.path.join('../data/', 'oracle_vad')
os.makedirs(output_dir,exist_ok=True)
MODEL_CONFIG = '../data/param.yaml'
config = OmegaConf.load(MODEL_CONFIG)
print(OmegaConf.to_yaml(config))
sd_model = ClusteringDiarizer(cfg = config)
sd_model.diarize()