import json, re, sys
from pathlib import Path
from docx import Document

GRAMMAR_CATEGORIES = {
    "一、": "verb-tenses", "二、": "connectors", "三、": "prepositions",
    "四、": "pronouns", "五、": "determiners", "六、": "verb-patterns",
    "七、": "adjectives-adverbs", "九、": "idioms"
}

GRAMMAR_CORRECTIONS = {
    "auth-grammar-043": (0, "Sans l'aide du gouvernement, l'entreprise serait fermée：sans + nom 表示与事实相反的条件，主句使用条件式现在时。"),
    "auth-grammar-122": (0, "On laisse une voiture dans la rue；这里 dans la rue 表示车辆停留在街道空间中。"),
    "auth-grammar-126": (1, "On met ou prend du sucre dans son café；dans 表示糖加入咖啡中。"),
    "auth-grammar-171": (0, "频率表达为 deux fois par jour，意思是每天两次。"),
    "auth-grammar-221": (0, "Poser un lapin à quelqu'un 表示约好后不出现且不通知对方。")
}

def clean(text):
    return re.sub(r"\*\*|__", "", text.replace("\u2003", " ")).strip()

def paragraphs(path):
    return [clean(p.text) for p in Document(path).paragraphs if clean(p.text)]

def split_options(text):
    text = clean(text)
    matches = list(re.finditer(r"(?:^|\s)([A-E])\.\s*", text))
    if len(matches) >= 2:
        return [text[m.end():matches[i + 1].start()].strip() if i + 1 < len(matches) else text[m.end():].strip() for i, m in enumerate(matches)]
    if "/" in text:
        parts = [part.strip(" /\t") for part in text.split("/") if part.strip(" /\t")]
        if 2 <= len(parts) <= 5: return parts
    return []

def level_for(category, index, total):
    ratio = index / max(total - 1, 1)
    bands = [(0.10, "A1"), (0.27, "A2"), (0.52, "B1"), (0.76, "B2"), (0.93, "C1"), (1.01, "C2")]
    return next(level for ceiling, level in bands if ratio < ceiling)

def difficulty_for(index, total):
    return min(10, max(1, round(1 + 9 * index / max(total - 1, 1))))

def grammar_questions(path):
    xs = paragraphs(path); raw = []; category = None; heading = ""
    i = 0
    while i < len(xs):
        line = xs[i]
        if line.startswith("## "):
            heading = line
            category = next((value for key, value in GRAMMAR_CATEGORIES.items() if key in line), None)
        match = re.match(r"^(\d+)\.\s*(.+)", line)
        if category and match and i + 2 < len(xs):
            opts = split_options(xs[i + 1])
            answer_line = xs[i + 2]
            answer_match = re.match(r"^([A-E])(?:\.|\b)", answer_line) or re.search(r"选([A-E])", answer_line)
            if 2 <= len(opts) <= 5 and answer_match:
                answer = ord(answer_match.group(1)) - 65
                if answer < len(opts):
                    raw.append({"sourceNumber": int(match.group(1)), "category": category, "heading": heading, "prompt": match.group(2), "options": opts, "answer": answer, "sourceExplanation": answer_line})
                    i += 3; continue
        i += 1
    totals = {}
    for item in raw: totals[item["category"]] = totals.get(item["category"], 0) + 1
    seen = {}
    result = []
    for order, item in enumerate(raw, 1):
        idx = seen.get(item["category"], 0); seen[item["category"]] = idx + 1
        answer_verified = not re.search(r"或|原答案|可能|缺过去分词", item["sourceExplanation"])
        question_id = f"auth-grammar-{order:03d}"
        result.append({
            "id": question_id, "type": "grammar", "exam": "shared", "sourceDocument": Path(path).name,
            "sourceNumber": item["sourceNumber"], "order": order, "category": item["category"], "topic": item["heading"].split("—")[0].replace("#", "").strip(),
            "prompt": item["prompt"], "options": item["options"], "answer": item["answer"], "answerVerified": answer_verified,
            "explanation": f"原文档答案：{item['sourceExplanation']}" if answer_verified else f"原文档答案存在歧义，等待校准：{item['sourceExplanation']}", "skill": item["category"].replace("-", "_"),
            "level": level_for(item["category"], idx, totals[item["category"]]), "levelEstimated": True, "difficulty": difficulty_for(idx, totals[item["category"]])
        })
        if question_id in GRAMMAR_CORRECTIONS:
            result[-1]["answer"], result[-1]["explanation"] = GRAMMAR_CORRECTIONS[question_id]
            result[-1]["answerVerified"] = True
    return result

def vocabulary_questions(path):
    xs = paragraphs(path); result = []; i = 0
    while i < len(xs):
        match = re.match(r"^(\d+)\.\s*(.+)", xs[i])
        if match and 1 <= int(match.group(1)) <= 215 and i + 1 < len(xs):
            opts = split_options(xs[i + 1])
            if 2 <= len(opts) <= 5:
                result.append({"sourceNumber": int(match.group(1)), "prompt": match.group(2), "options": opts, "passage": "", "skill": "collocation", "category": "collocations"}); i += 2; continue
        i += 1
    current_passage = ""; current_title = ""
    for i, line in enumerate(xs):
        if line.startswith("完形填空 "):
            current_title = line; current_passage = xs[i + 1] if i + 1 < len(xs) else ""
        opts_match = re.match(r"^\((\d+)\)\s+(.+)", line)
        if current_passage and opts_match:
            opts = split_options(opts_match.group(2))
            if 2 <= len(opts) <= 5: result.append({"sourceNumber": f"{current_title}-{opts_match.group(1)}", "prompt": f"选择最合适的词完成第 {opts_match.group(1)} 个空。", "options": opts, "passage": current_passage, "skill": "collocation", "category": "collocations"})
        synonym = re.match(r"^(.+?)\s*=\s*(.+)", line)
        if synonym and current_passage:
            opts = split_options(synonym.group(2))
            if 2 <= len(opts) <= 5: result.append({"sourceNumber": current_title, "prompt": f"Dans ce texte, quel est le synonyme le plus proche de « {synonym.group(1).strip()} » ?", "options": opts, "passage": current_passage, "skill": "synonymes", "category": "lexical-relations"})
    totals = {}; seen = {}
    for item in result: totals[item["category"]] = totals.get(item["category"], 0) + 1
    for order, item in enumerate(result, 1):
        idx = seen.get(item["category"], 0); seen[item["category"]] = idx + 1
        item.update({"id": f"auth-vocab-{order:03d}", "type": "vocabulary", "exam": "shared", "sourceDocument": Path(path).name, "order": order,
                     "topic": "词汇真题", "answer": None, "answerVerified": False, "explanation": "原文档未提供答案，等待逐题校准。",
                     "level": level_for(item["category"], idx, totals[item["category"]]), "levelEstimated": True, "difficulty": difficulty_for(idx, totals[item["category"]])})
    return result

def reading_questions(path):
    xs = paragraphs(path); result = []; passage = ""; source_group = ""
    group_starts = [i for i, line in enumerate(xs) if re.match(r"^### 第\d+题$", line)] + [len(xs)]
    for gi in range(len(group_starts) - 1):
        block = xs[group_starts[gi]:group_starts[gi + 1]]; source_group = block[0].replace("### ", "")
        question_pattern = r"^(?:题目\d*：|Question\s*:)"
        q_positions = [i for i, line in enumerate(block) if re.match(question_pattern, line, re.I)]
        if not q_positions: continue
        passage_lines = [line for line in block[1:q_positions[0]] if line not in {"阅读文本：", "---"}]
        if passage_lines: passage = "\n".join(passage_lines)
        for qi, start in enumerate(q_positions):
            end = q_positions[qi + 1] if qi + 1 < len(q_positions) else len(block)
            chunk = [line for line in block[start:end] if line != "---"]
            first = re.sub(question_pattern + r"\s*", "", chunk[0], flags=re.I).strip()
            labeled = r"^\|?\s*[A-E](?:[\.\)\s]|\s*\|)"
            option_start = next((j for j, line in enumerate(chunk[1:], 1) if re.match(labeled, line) or len(split_options(line)) >= 2), None)
            if option_start is None and len(chunk) >= 5: option_start = max(1, len(chunk) - 4)
            if option_start is None: continue
            prompt = " ".join([first] + chunk[1:option_start]).strip()
            if not prompt: prompt = "Quelle est la bonne réponse selon le document ?"
            option_lines = chunk[option_start:]
            if len(option_lines) >= 4 and all(re.match(labeled, line) for line in option_lines[:4]):
                opts = []
                for line in option_lines[:5]:
                    if not re.match(labeled, line): break
                    value = re.sub(r"^\|?\s*[A-E](?:[\.\)]\s*|\s*\|\s*)", "", line).strip().strip("|").strip()
                    opts.append(value)
            elif len(option_lines) >= 4 and not any(line.startswith(("阅读文本：", "###")) for line in option_lines[:4]): opts = option_lines[:4]
            else: opts = split_options(option_lines[0])
            if 2 <= len(opts) <= 5 and prompt and passage:
                result.append({"sourceNumber": source_group, "prompt": prompt, "options": opts, "passage": passage})
    total = len(result)
    for order, item in enumerate(result, 1):
        words = len(item["passage"].split()); difficulty = min(10, max(1, round(2 + min(words, 500) / 65)))
        level = ["A1", "A2", "B1", "B2", "C1", "C2"][min(5, max(0, (difficulty - 1) // 2))]
        lower = item["prompt"].lower()
        if re.search(r"quand|où|combien|que doit|quelle information|d'après|selon", lower): category, skill = "reading-explicit", "information_explicite"
        elif re.search(r"pourquoi|objectif|but|intention|idée principale|présenté|insiste|auteur", lower): category, skill = "reading-purpose", "idee_principale"
        else: category, skill = "reading-inference", "inference"
        item.update({"id": f"auth-reading-{order:03d}", "type": "reading", "exam": "shared", "sourceDocument": Path(path).name, "order": order,
                     "topic": "阅读真题", "skill": skill, "category": category, "answer": None, "answerVerified": False,
                     "explanation": "原文档未提供答案，等待逐题校准。", "level": level, "levelEstimated": True, "difficulty": difficulty})
    return result

def main():
    if len(sys.argv) != 5: raise SystemExit("usage: script grammar.docx vocab.docx reading.docx output.json")
    questions = grammar_questions(sys.argv[1]) + vocabulary_questions(sys.argv[2]) + reading_questions(sys.argv[3])
    Path(sys.argv[4]).parent.mkdir(parents=True, exist_ok=True)
    Path(sys.argv[4]).write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = {}
    for q in questions:
        key = (q["type"], "ready" if q["answerVerified"] else "pending")
        summary[key] = summary.get(key, 0) + 1
    report = {
        "totalImported": len(questions), "summary": {f"{k[0]}_{k[1]}": v for k, v in summary.items()},
        "sourceAudit": {
            "TCF TEF语法.docx": {"headlineClaim": 358, "structurallyCompleteImported": sum(q["type"] == "grammar" for q in questions), "note": "文档后半部分含只提及题量但没有题干的压缩说明，且各处自述数字互相矛盾。"},
            "TCF词汇题.docx": {"singleQuestions": 215, "clozeBlanks": 14, "synonymQuestions": 15, "structurallyCompleteImported": sum(q["type"] == "vocabulary" for q in questions), "answerKeyPresent": False},
            "TCFTEF阅读.docx": {"questionMarkers": 233, "structurallyCompleteImported": sum(q["type"] == "reading" for q in questions), "incompleteSourceGroups": [64, 76, 77, 78], "answerKeyPresent": False}
        }
    }
    report_path = Path(sys.argv[4]).with_name("import-report.json"); report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__": main()
