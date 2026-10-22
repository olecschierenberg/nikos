import re,json,glob,sys,os,shutil,collections,html as H
MODE=sys.argv[1] if len(sys.argv)>1 else 'dry'
SITE=os.path.expanduser('~/mnt/nikos/site'); os.chdir(SITE)
I18N=json.load(open(os.path.expanduser('~/i18n_export.json'),encoding='utf-8'))
LOGO='<a class="nk-mod" href="https://nikos.info/index.html"><img src="https://nikos.info/assets/logos/nikos/SVG/NIKOS.svg" alt="NIKOS" loading="lazy"></a>'
NK='\u0003NK\u0004'
PARTNER='https://nikos.info/de/vermietung/#partnerauswahl'
LISTS={
'de':(r'Laternen(?:masten)?',r'(?:Dekorationselementen|Dekorationen|anderen geeigneten Konstruktionen)','Laternen, Bühnen, Buden oder Bäumen'),
'en':(r'(?:lamp ?posts?|street ?(?:lamps|lights)|lanterns)',r'(?:decorative elements?|decorations?)','lampposts, stages, stands or trees'),
'fr':(r'(?:des )?lampadaires',r'(?:des )?(?:éléments de décoration|décorations)','des lampadaires, des scènes, des stands ou des arbres'),
'it':(r'(?:lampioni|pali dell[’\']illuminazione|pali della luce)',r'(?:elementi decorativi|decorazioni)','lampioni, palchi, bancarelle o alberi'),
'es':(r'farolas',r'(?:elementos decorativos|decoraciones)','farolas, escenarios, puestos o árboles'),
'nl':(r'lantaarnpalen',r'(?:decoratieve elementen|decoraties)','lantaarnpalen, podia, kraampjes of bomen'),
'da':(r'(?:gadelygter|lygtepæle)',r'(?:dekorationselementer|dekorationer)','lygtepæle, scener, boder eller træer'),
'pl':(r'latarnie',r'(?:elementy dekoracyjne|dekoracje)','latarnie, sceny, stoiska lub drzewa'),
}
COST_NEW={
'de':f'{NK} reduziert vor allem den Aufwand für separate Lautsprecher-, Steuer- und Kommunikationslösungen. Materialbedarf und Verkabelungsaufwand werden geringer, Informations- und Notfalldurchsagen lassen sich von einer Stelle aus machen.',
'en':f'{NK} mainly reduces the effort required for separate loudspeaker, control and communication solutions. Material requirements and cabling work are reduced, and information and emergency announcements can be made from a single location.',
'fr':f'{NK} réduit avant tout l’effort lié à des solutions séparées de sonorisation, de commande et de communication. Les besoins en matériel et en câblage diminuent, et les annonces d’information et d’urgence peuvent être diffusées depuis un seul point.',
'it':f'{NK} riduce soprattutto l’impegno per soluzioni separate di diffusione sonora, controllo e comunicazione. Si riducono il fabbisogno di materiale e il lavoro di cablaggio, e gli annunci informativi e di emergenza possono essere effettuati da un unico punto.',
'es':f'{NK} reduce sobre todo el esfuerzo necesario para soluciones separadas de megafonía, control y comunicación. Disminuyen las necesidades de material y el trabajo de cableado, y los avisos informativos y de emergencia pueden realizarse desde un único punto.',
'nl':f'{NK} verlaagt vooral de inspanning voor afzonderlijke oplossingen voor omroep, aansturing en communicatie. De materiaalbehoefte en de bekabeling nemen af, en informatie- en noodomroepen kunnen vanaf één punt worden gedaan.',
'da':f'{NK} reducerer først og fremmest indsatsen til separate løsninger til højttalere, styring og kommunikation. Materialebehovet og kabelarbejdet bliver mindre, og informations- og nødudsagn kan foretages fra ét sted.',
'pl':f'{NK} ogranicza przede wszystkim nakład pracy związany z oddzielnymi rozwiązaniami w zakresie nagłośnienia, sterowania i komunikacji. Zmniejsza się zapotrzebowanie na materiały i nakład pracy przy okablowaniu, a komunikaty informacyjne i alarmowe można nadawać z jednego miejsca.',
}
START_KW={'de':(r'Lautsprecher',r'Steuer'),'en':(r'loudspeaker',r'control'),'fr':(r'haut-parleur|sonorisation',r'command|contrôle'),
'it':(r'altoparlant|diffusione sonora',r'controllo'),'es':(r'altavoc|megafon',r'control'),'nl':(r'luidspreker|omroep',r'aansturing|besturing|bediening'),
'da':(r'højttaler',r'styring'),'pl':(r'głośnik|nagłośnieni',r'sterowa')}
END_KW={'de':(r'Material',r'Kabel|Verkabel'),'en':(r'material',r'cabl'),'fr':(r'matériel|matériaux',r'câbl'),'it':(r'material',r'cablagg|cavi'),
'es':(r'material',r'cablead|cables'),'nl':(r'materiaal',r'kabel|bekabel'),'da':(r'materiale',r'kabel'),'pl':(r'materiał',r'kabl|okablowa')}
SEP=r'separat|getrennt|separate|séparé|oddziel|afzonderlijk|separad|separati|appart|aparte|abzonder|independient|distint|distinct|indépendant|osobn|zonder'
DIN_OLD=re.compile(r'^Die dort genannten Anforderungen werden von (?:\u0003NK\u0004|NIKOS) voll erfüllt, da .*')
DIN_NEW=f'Die dort genannten Anforderungen werden von {NK} im Gegensatz zu mobilfunkbasierten Systemen voll erfüllt, da keine Abhängigkeit von einem fremden Netz besteht und somit jederzeit eine sofortige Nutzbarkeit gewährleistet ist.'
F5Q={'de':'Wo kann man NIKOS mieten?','en':'Where can NIKOS be rented?','fr':'Où peut-on louer NIKOS ?','it':'Dove si può noleggiare NIKOS?','es':'¿Dónde se puede alquilar NIKOS?','nl':'Waar kan NIKOS worden gehuurd?','da':'Hvor kan NIKOS lejes?','pl':'Gdzie można wynająć NIKOS?'}
F5A={'de':f'{NK} wird tageweise über zertifizierte Partner vermietet, inklusive Beratung, Einweisung und technischem Support. Ihr regionaler Partner stimmt den Einsatz mit Ihnen ab.',
'en':f'{NK} is rented by the day through certified partners, including advice, instruction and technical support. Your regional partner coordinates the deployment with you.',
'fr':f'{NK} est loué à la journée via des partenaires certifiés, conseil, formation et assistance technique inclus. Votre partenaire régional coordonne l’intervention avec vous.',
'it':f'{NK} viene noleggiato a giornata tramite partner certificati, con consulenza, istruzione e supporto tecnico inclusi. Il partner regionale concorda l’impiego con voi.',
'es':f'{NK} se alquila por días a través de socios certificados, con asesoramiento, instrucción y soporte técnico incluidos. Su socio regional coordina la intervención con usted.',
'nl':f'{NK} wordt per dag verhuurd via gecertificeerde partners, inclusief advies, instructie en technische ondersteuning. Uw regionale partner stemt de inzet met u af.',
'da':f'{NK} udlejes pr. dag via certificerede partnere, inklusive rådgivning, instruktion og teknisk support. Jeres regionale partner afstemmer indsatsen med jer.',
'pl':f'{NK} jest wynajmowany na doby przez certyfikowanych partnerów, wraz z doradztwem, instruktażem i wsparciem technicznym. Regionalny partner uzgadnia zakres użycia z Państwem.'}
stats=collections.Counter(); problems=collections.defaultdict(list)
def split_sent(t):
    parts=re.split(r'(?<=[.!?])\s+',t); out=[]
    for p in parts:
        if out and (re.search(r'(?:\b[A-Za-zÄÖÜäöü]{1,2}|\d)\.$',out[-1]) or re.search(r'\b(?:bzw|ca|etc)\.$',out[-1])): out[-1]+=' '+p
        else: out.append(p)
    return out
def transform(text, html_mode):
    st=[]
    if html_mode:
        def stash(m): st.append(m.group(0)); return '\u0001%d\u0002'%(len(st)-1)
        text=re.sub(r'<a class="nk-mod"[^>]*>.*?</a>',stash,text,flags=re.S)
    changed=set()
    if 'Schuko' in text:
        for lg,(a,b,rep) in LISTS.items():
            text,n=re.compile(a+r'[^.<]*?'+b).subn(rep,text)
            if n: changed.add('install'); stats['install_'+lg]+=1
    sents=split_sent(text)
    for i,s in enumerate(sents):
        if DIN_OLD.match(re.sub(r'\u0001\d+\u0002',NK,s)):
            sents[i]=DIN_NEW; changed.add('din'); stats['din']+=1
    for lg,(k1,k2) in START_KW.items():
        e1,e2=END_KW[lg]
        s_idx=[i for i,s in enumerate(sents) if re.search(k1,s,re.I) and re.search(k2,s,re.I) and re.search(SEP,s,re.I)]
        e_idx=[i for i,s in enumerate(sents) if re.search(e1,s,re.I) and re.search(e2,s,re.I)]
        if s_idx:
            a=s_idx[0]; b=[x for x in e_idx if x>=a]
            if b and b[0]-a<=2:
                sents[a:b[0]+1]=[COST_NEW[lg]]; changed.add('cost'); stats['cost_'+lg]+=1; break
            else:
                sents[a:a+1]=[COST_NEW[lg]]; changed.add('cost_startonly'); stats['coststart_'+lg]+=1; break
    out=' '.join(sents)
    out=out.replace(NK,LOGO if html_mode else 'NIKOS')
    if html_mode: out=re.sub(r'\u0001(\d+)\u0002',lambda m:st[int(m.group(1))],out)
    return out,changed
def plain(x): return H.unescape(re.sub(r'<[^>]+>','',x))
DEC=r'Dekoration|decoration|décoration|decorazion|elementi decorativi|decoracion|elementos decorativos|decorati|dekoration|dekoracj|elementy dekoracyjne'
STYLE='max-width:860px;margin:0 0 32px;padding-left:18px;border-left:4px solid var(--orange);font-size:clamp(18px,2vw,22px);font-weight:600;line-height:1.5;color:var(--dark);'
def process(f):
    h=open(f,encoding='utf-8').read()
    dual=f.startswith('loesungen/'); lang='de' if dual else f.split('/')[0]
    if 'lp-lead' in h: stats['skip_done']+=1; return None
    m=re.search(r'<script type="application/ld\+json">\s*(.*?)\s*</script>',h,re.S)
    if not m: problems['nojson'].append(f); return None
    j=json.loads(m.group(1))
    if j.get('@type')!='FAQPage': problems['notfaq'].append(f); return None
    chg=collections.Counter(); qa=j['mainEntity']
    cost_before=any(('Kabelbr' in q['acceptedAnswer']['text'] or 'cable ramps' in q['acceptedAnswer']['text'] or 'Lautsprecher' in q['acceptedAnswer']['text']) and 'Kosten' in q['name'] or 'cost' in q['name'].lower() for q in qa)
    for q in qa:
        a,c=transform(q['acceptedAnswer']['text'],False)
        q['acceptedAnswer']['text']=a
        for x in c: chg[x]+=1
        if 'Schuko' in a and re.search(DEC,a,re.I): problems['dekor_rest'].append((f,a[:120]))
    def body(mm):
        attr=mm.group(1) or ''
        new,c=transform(mm.group(2),True)
        return '<div class="faq-item__body"%s>%s</div>'%(attr,new)
    h2=re.sub(r'<div class="faq-item__body"([^>]*)>(.*?)</div>',body,h,flags=re.S)
    desc=H.unescape(re.search(r'<meta name="description" content="([^"]*)"',h).group(1))
    canon=re.search(r'<link rel="canonical" href="([^"]+)"',h).group(1)
    h1=re.findall(r'<h1[^>]*>(.*?)</h1>',h,re.S)[0]
    if dual:
        mm=re.search(r'<span data-de>(.*?)</span>',h1,re.S); h1_de=plain(mm.group(1)) if mm else plain(h1)
        mm=re.search(r'<span data-en>(.*?)</span>',h1,re.S); h1_en=plain(mm.group(1)) if mm else h1_de
    else: h1_de=h1_en=plain(h1)
    L=I18N[lang]
    q5=h1_de+': '+F5Q[lang]
    link='<a href="%s">%s</a>'%(PARTNER,L['RENT_LINK'])
    qa.append({'@type':'Question','name':q5,'acceptedAnswer':{'@type':'Answer','text':F5A[lang].replace(NK,'NIKOS')+' '+link}})
    region=(j.get('about') or {}).get('name'); url=canon
    org={'@type':'Organization','@id':'https://nikos.info/#organization','name':'RADACOM GmbH','url':'https://nikos.info','logo':'https://nikos.info/assets/logos/nikos/SVG/NIKOS.svg','contactPoint':{'@type':'ContactPoint','telephone':'+49-2941-750330','contactType':'customer service','availableLanguage':['German','English']},'address':{'@type':'PostalAddress','streetAddress':'Rigaer Str. 3','addressLocality':'Lippstadt','postalCode':'59557','addressCountry':'DE'},'sameAs':['https://radacom.de']}
    svc={'@type':'Service','@id':url+'#service','name':h1_de,'description':desc,'url':url,'serviceType':'Rental of radio-based public address, alarm and control systems','provider':{'@id':'https://nikos.info/#organization'},'inLanguage':lang,'termsOfService':'https://nikos.info/de/mietbedingungen/' if lang=='de' else 'https://nikos.info/en/rental-terms/'}
    if region: svc['areaServed']={'@type':'Place','name':region}
    crumb={'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':L['HOME'],'item':'https://nikos.info/%s/'%lang},{'@type':'ListItem','position':2,'name':L['ALL'],'item':'https://nikos.info/loesungen/'},{'@type':'ListItem','position':3,'name':h1_de,'item':url}]}
    faq={'@type':'FAQPage','@id':url+'#faq','mainEntity':qa}
    if region: faq['about']={'@type':'Place','name':region}
    ld='<script type="application/ld+json">\n'+json.dumps({'@context':'https://schema.org','@graph':[org,svc,crumb,faq]},ensure_ascii=False,indent=2)+'\n</script>'
    if m.group(0) not in h2: problems['ld_replace'].append(f); return None
    h2=h2.replace(m.group(0),ld,1)
    if dual:
        lead='<p class="body-l lp-lead" style="%s" data-de>%s</p>\n    <p class="body-l lp-lead" style="%s" data-en>%s</p>\n    '%(STYLE,I18N['de']['LEAD'],STYLE,I18N['en']['LEAD'])
        anchor='<div class="intro-s2__inner">\n    <span class="nk-label" data-de>'
    else:
        lead='<p class="body-l lp-lead" style="%s">%s</p>\n    '%(STYLE,L['LEAD'])
        anchor='<div class="intro-s2__inner">\n    <span class="nk-label">'
    if h2.count(anchor)!=1: problems['lead_anchor'].append(f); return None
    h2=h2.replace(anchor,anchor.replace('<span',lead+'<span',1),1)
    k=h2.rfind('</details>')
    if dual:
        d5='\n      <details class="faq-item">\n        <summary><span class="faq-q" data-de>%s</span><span class="faq-q" data-en>%s</span><span class="faq-icon">+</span></summary>\n        <div class="faq-item__body" data-de>%s <a href="%s">%s</a></div>\n        <div class="faq-item__body" data-en>%s <a href="%s">%s</a></div>\n      </details>'%((h1_de+': '+F5Q['de']).replace('NIKOS',LOGO),(h1_en+': '+F5Q['en']).replace('NIKOS',LOGO),F5A['de'].replace(NK,LOGO),PARTNER,I18N['de']['RENT_LINK'],F5A['en'].replace(NK,LOGO),PARTNER,I18N['en']['RENT_LINK'])
    else:
        d5='\n      <details class="faq-item">\n        <summary><span class="faq-q">%s</span><span class="faq-icon">+</span></summary>\n        <div class="faq-item__body">%s <a href="%s">%s</a></div>\n      </details>'%(q5.replace('NIKOS',LOGO),F5A[lang].replace(NK,LOGO),PARTNER,L['RENT_LINK'])
    h2=h2[:k+10]+d5+h2[k+10:]
    for x in chg: stats['pages_'+x]+=1
    if cost_before and 'cost' not in chg and 'cost_startonly' not in chg: problems['cost_unmatched'].append(f)
    return h2
files=[x for x in open('/tmp/lpfiles.txt').read().split('\n') if x]
res={}
for f in files:
    try: r=process(f)
    except Exception as e: problems['exception'].append((f,repr(e)[:160])); r=None
    if r: res[f]=r
print('MODE',MODE,'OK:',len(res),'of',len(files))
for k,v in sorted(stats.items()): print(' ',k,v)
for k,v in problems.items(): print('PROBLEM',k,len(v),v[:3])
if MODE=='apply':
    B='backups/lp-migration-20261022'
    for f in res:
        d=os.path.join(B,os.path.dirname(f)); os.makedirs(d,exist_ok=True); shutil.copy2(f,os.path.join(B,f))
    for f,r in res.items(): open(f,'w',encoding='utf-8').write(r)
    print('APPLIED',len(res))
if MODE=='dbg':
    import itertools
    for f in problems['cost_unmatched'][:3]+[x for x in files if x.startswith('fr/') ][:0]:
        h=open(f,encoding='utf-8').read(); j=json.loads(re.search(r'<script type="application/ld\+json">\s*(.*?)\s*</script>',h,re.S).group(1))
        for q in j['mainEntity']:
            if re.search(r'Kosten|cost',q['name'],re.I): print(f,'\nQ:',q['name'],'\nA:',q['acceptedAnswer']['text'][:1400],'\n')
    for lg in ['fr','es','it']:
        k=0
        for f in files:
            if f.startswith(lg+'/'):
                h=open(f,encoding='utf-8').read(); m=re.search(r'<script type="application/ld\+json">\s*(.*?)\s*</script>',h,re.S)
                if not m: continue
                for q in json.loads(m.group(1))['mainEntity']:
                    if re.search(r'Schuko',q['acceptedAnswer']['text']) is None and re.search(r'économ|cost|coût|ahorr|costo|risparm|kost|besparing|omkost|oszcz|koszt',q['name'],re.I):
                        print(lg,f,'\nQ:',q['name'],'\nA:',q['acceptedAnswer']['text'][:1200],'\n'); k+=1
                        break
            if k>=1: break
    for f in ['it/lp/allerta-meteo-gentse-feesten/index.html']:
        h=open(f,encoding='utf-8').read(); m=re.search(r'<script type="application/ld\+json">\s*(.*?)\s*</script>',h,re.S)
        for q in json.loads(m.group(1))['mainEntity']:
            if 'Schuko' in q['acceptedAnswer']['text']: print(q['acceptedAnswer']['text'][:600])
def faqs_of(h):
    m=re.search(r'<script type="application/ld\+json">\s*(.*?)\s*</script>',h,re.S); j=json.loads(m.group(1))
    items=j.get('@graph',[j]); return [i for i in items if i.get('@type')=='FAQPage'][0]['mainEntity']
if MODE=='show':
    for f in sys.argv[2:]:
        old={q['name']:q['acceptedAnswer']['text'] for q in faqs_of(open(f,encoding='utf-8').read())}
        if f not in res: print('NOT PROCESSED',f); continue
        for q in faqs_of(res[f]):
            o=old.get(q['name'])
            if o!=q['acceptedAnswer']['text']:
                print('=====',f,'\nQ:',q['name'],'\nOLD:',(o or '(neu)')[:1300],'\nNEW:',q['acceptedAnswer']['text'][:1300],'\n')
