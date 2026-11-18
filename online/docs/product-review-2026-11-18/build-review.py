"""Build the self-contained review reader from project Markdown (stdlib only)."""
from pathlib import Path
import html
import re

root=Path(__file__).resolve().parent

def inline(value):
    value=html.escape(value)
    value=re.sub(r'`([^`]+)`',r'<code>\1</code>',value)
    value=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',value)
    value=re.sub(r'!\[([^\]]*)\]\(([^)]+)\)',r'<img loading="lazy" src="\2" alt="\1">',value)
    value=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'<a href="\2">\1</a>',value)
    return value

def markdown(source):
    lines=source.splitlines();out=[];i=0;toc=[]
    while i<len(lines):
        line=lines[i]
        if not line.strip():i+=1;continue
        if line.startswith('```'):
            block=[];i+=1
            while i<len(lines) and not lines[i].startswith('```'):block.append(lines[i]);i+=1
            out.append('<pre><code>'+html.escape('\n'.join(block))+'</code></pre>');i+=1;continue
        m=re.match(r'^(#{1,6}) (.+)',line)
        if m:
            level=len(m[1]);title=m[2];anchor='section-'+re.sub(r'[^\w-]','-',title).strip('-')
            if level==2:toc.append((anchor,title))
            out.append(f'<h{level} id="{anchor}">'+inline(title)+f'</h{level}>');i+=1;continue
        if line.startswith('|') and i+1<len(lines) and re.match(r'^\|[\s:|\-]+$',lines[i+1]):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                if not re.match(r'^\|[\s:|\-]+$',lines[i]):rows.append([x.strip() for x in lines[i].strip().strip('|').split('|')])
                i+=1
            table='<div class="table-scroll"><table><thead><tr>'+''.join('<th>'+inline(x)+'</th>' for x in rows[0])+'</tr></thead><tbody>'
            table+=''.join('<tr>'+''.join('<td>'+inline(x)+'</td>' for x in row)+'</tr>' for row in rows[1:])+'</tbody></table></div>'
            out.append(table);continue
        if re.match(r'^[-*] ',line):
            items=[]
            while i<len(lines) and re.match(r'^[-*] ',lines[i]):items.append('<li>'+inline(lines[i][2:])+'</li>');i+=1
            out.append('<ul>'+''.join(items)+'</ul>');continue
        if re.match(r'^\d+\. ',line):
            items=[]
            while i<len(lines) and re.match(r'^\d+\. ',lines[i]):items.append('<li>'+inline(re.sub(r'^\d+\. ','',lines[i]))+'</li>');i+=1
            out.append('<ol>'+''.join(items)+'</ol>');continue
        if line.startswith('>'):
            out.append('<blockquote>'+inline(line.lstrip('> '))+'</blockquote>');i+=1;continue
        para=[line];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||[-*] |\d+\. |```|>)',lines[i]):para.append(lines[i]);i+=1
        out.append('<p>'+inline(' '.join(para))+'</p>')
    return '\n'.join(out),toc

css='''
:root{--paper:#f7f5f0;--ink:#242522;--muted:#65685f;--line:#d8d8cf;--red:#bd322e}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.85 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}a{color:var(--red);text-underline-offset:4px}a:hover{text-decoration-thickness:2px}:focus-visible{outline:2px solid var(--red);outline-offset:4px}.top{border-bottom:1px solid var(--line);padding:18px 5vw;display:flex;gap:16px;justify-content:space-between;font-size:13px}.top a{color:var(--ink)}.shell{display:grid;grid-template-columns:220px minmax(0,900px);gap:48px;max-width:1260px;margin:40px auto;padding:0 24px}.toc{position:sticky;top:24px;align-self:start;font-size:13px;line-height:1.6}.toc a{display:block;color:var(--muted);text-decoration:none;padding:7px 0}.toc a:hover{color:var(--red)}.toc b{display:block;margin:0 0 12px}.toc .extra{margin-top:22px;border-top:1px solid var(--line);padding-top:14px}article{min-width:0;overflow-wrap:anywhere}article img{max-width:100%;height:auto}h1{font-size:40px;letter-spacing:-.035em;line-height:1.35;margin:0 0 20px;max-width:850px}h2{font-size:26px;line-height:1.5;margin:60px 0 22px;padding-top:26px;border-top:1px solid var(--line)}h3{font-size:20px;line-height:1.6;margin:34px 0 14px}p{margin:0 0 20px}li{margin:10px 0}ul,ol{padding-left:24px}strong{font-weight:650}code{font:13px/1.6 Consolas,monospace;background:#eeebe4;padding:2px 5px;border-radius:3px}pre{overflow:auto;padding:18px;background:#eeebe4}.table-scroll{overflow:auto;border:1px solid var(--line);border-radius:8px;margin:22px 0 28px}table{border-collapse:collapse;width:100%;min-width:650px;font-size:14px;line-height:1.75}th,td{text-align:left;vertical-align:top;padding:14px 16px;border-bottom:1px solid var(--line)}th{background:#eeebe4;font-weight:650}tr:last-child td{border-bottom:0}th:first-child,td:first-child{min-width:125px}blockquote{margin:24px 0;border-left:3px solid var(--red);padding:4px 20px;color:var(--muted)}.evidence-strip{margin:24px 0 32px;padding:20px;background:#eeebe4;border-radius:10px}.evidence-strip .caption{font-size:13px;color:var(--muted);margin-top:12px}.evidence-images{display:grid;grid-template-columns:1fr 1fr 120px;gap:12px;align-items:start}.evidence-images a{display:block;max-height:230px;overflow:hidden;border:1px solid var(--line);border-radius:5px}.evidence-images img{display:block;width:100%;height:auto}.callout{background:#22231d;color:#eee9dd;padding:24px 28px;border-radius:10px;margin:26px 0}.callout b{display:block;font-size:21px;margin-bottom:8px}.callout a{display:inline-block;color:#f2d5be;margin-top:14px}.callout p{margin:0;color:#d0c7b5;font-size:14px}.backtop{position:fixed;bottom:20px;right:20px;border:1px solid var(--line);background:var(--paper);padding:8px 13px;border-radius:6px;font-size:13px}.footer{padding:40px 24px;text-align:center;font-size:13px;color:var(--muted);border-top:1px solid var(--line)}@media(max-width:900px){.shell{display:block;max-width:800px}.toc{position:static;border-bottom:1px solid var(--line);margin-bottom:30px;padding-bottom:18px;display:flex;gap:12px;flex-wrap:wrap}.toc b,.toc .extra{display:none}.toc a{padding:4px 0}h1{font-size:32px}h2{font-size:24px}.evidence-images{grid-template-columns:1fr 1fr}.evidence-images a:last-child{display:none}}@media(max-width:500px){body{font-size:15px}.shell{padding:0 18px;margin-top:24px}h1{font-size:28px}h2{font-size:22px;margin-top:44px}.top{font-size:12px;flex-wrap:wrap}.evidence-strip{padding:12px}.evidence-images{gap:7px}.callout{padding:20px}table{font-size:13px}.backtop{display:none}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{.toc,.top,.backtop{display:none}.shell{display:block;margin:0;max-width:none}.table-scroll{overflow:visible}table{min-width:0}h2{break-after:avoid}.callout{color:#242522;background:#eee}.callout p,.callout a{color:#242522}}
'''

sources=[('REVIEW.md','review.html','总评与改进计划'),('product-ux-review.md','product-ux-review.html','产品与体验独立评审'),('reference-research.md','reference-research.html','优秀产品参考调查'),('visual-review.md','visual-review.html','视觉与审美独立评审')]
for source,target,label in sources:
    content,toc=markdown((root/source).read_text(encoding='utf-8'))
    for old,new,_ in sources:content=content.replace('href="'+old+'"','href="'+new+'"')
    if source=='REVIEW.md':
        split=content.find('<h2 ')
        panel='''<div class="evidence-strip"><div class="evidence-images"><a href="screenshots/live-home-desktop.png"><img src="screenshots/live-home-desktop.png" alt="当前线上首页"></a><a href="screenshots/desktop-first-decision.png"><img src="screenshots/desktop-first-decision.png" alt="本地真实第一轮"></a><a href="screenshots/mobile-first-decision.png"><img src="screenshots/mobile-first-decision.png" alt="390像素宽第一轮"></a></div><div class="caption">本轮当前版本证据：线上首页 / 本地第一轮 / 手机窄视口。点击查看原图。</div></div><div class="callout"><b>推荐：有引导的增长酒馆</b><p>按课堂意图入席 → 读懂本局 → 第一轮有依据地行动 → 用真实回合复盘。保留真实围桌与纸白阅读。</p><a href="direction-demo.html">打开四个状态的改进结构示意 →</a></div>'''
        content=content[:split]+panel+content[split:]
    nav='<b>本次评审</b>'+''.join('<a href="#'+a+'">'+html.escape(t)+'</a>' for a,t in toc)
    nav+='<div class="extra">'+''.join('<a href="'+t+'">'+l+'</a>' for _,t,l in sources)+'<a href="direction-demo.html">改进结构示意</a></div>'
    page='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+label+' · 增长酒馆</title><style>'+css+'</style><body id="top"><div class="top"><span>增长黑客 / 增长酒馆 · 产品设计评审</span><span>2026.11.18 · 基于线上版本 8 · <a href="review.html">总报告</a></span></div><div class="shell"><nav class="toc" aria-label="报告目录">'+nav+'</nav><article>'+content+'</article></div><a class="backtop" href="#top">回到顶部 ↑</a><footer class="footer">本地评审文档与结构示意。本轮未改动或发布生产产品。</footer></body></html>'
    (root/target).write_text(page,encoding='utf-8')
    print(target)
