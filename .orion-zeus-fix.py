import base64,gzip,json,pathlib
B='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'
b=json.loads(gzip.decompress(base64.b64decode(B)))
p=pathlib.Path('data/ORION_season_compact.json')
d=json.loads(p.read_text(encoding='utf-8'))
oldids={'176','177','178','179','180','181','182','183','187','188','189','190','191'}
# metadata
d['generatedAt']=b['generatedAt']; d['source']=b['source']; new_source=b['source']['recruitmentProfiles']
# replace team and normalize recruitment source metadata
for i,t in enumerate(d['teams']):
    if t.get('teamId')=='zeus': d['teams'][i]=b['zeusTeam']
    elif t.get('sourceFile')=='PULL_SVINCOLATI_ORION_senza_Dave_Quagmire.json': t['sourceFile']=new_source
# canonical players: remove obsolete Zeus-only players, add Zeus Ares canonical players
d['players']=[x for x in d['players'] if str(x.get('playerId')) not in oldids]
existing={str(x.get('playerId')) for x in d['players']}
d['players'].extend(x for x in b['zeusPlayers'] if str(x.get('playerId')) not in existing)
# profiles: remove obsolete Zeus profiles, add Zeus Ares profiles, update recruitment source filename
d['profiles']=[x for x in d['profiles'] if x.get('teamId')!='zeus']
for x in d['profiles']:
    if x.get('sourceKind')=='recruitment_source': x['sourceFile']=new_source
d['profiles'].extend(b['zeusProfiles'])
# recruitment entries
entries=[x for x in d['recruitmentPool']['entries'] if x.get('sourceTeamId')!='zeus']
entries.extend(b['zeusRecruitment'])
d['recruitmentPool']['entries']=entries
d['summary']=b['summary']; d['validation']=b['validation']
# hard validation
assert len(d['players'])==308
assert len(d['profiles'])==328
assert len(d['recruitmentPool']['entries'])==128
assert any(t.get('teamId')=='zeus_ares' and t.get('teamName')=='Zeus Ares' for t in d['teams'])
assert not any(t.get('teamId')=='zeus' for t in d['teams'])
assert not any(str(x.get('playerId')) in oldids for x in d['players'])
assert not any(x.get('teamId')=='zeus' or str(x.get('profileId','')).endswith('@zeus') for x in d['profiles'])
assert not any(x.get('sourceTeamId')=='zeus' for x in d['recruitmentPool']['entries'])
newids={'4518','4523','4522','4521','4519','4525','4520','4527','4517','4524'}
assert {str(x.get('playerId')) for x in d['recruitmentPool']['entries'] if x.get('sourceTeamId')=='zeus_ares'}==newids
p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print('Orion Zeus Ares correction validated:',len(d['players']),len(d['profiles']),len(d['recruitmentPool']['entries']))
