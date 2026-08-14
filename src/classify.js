const RULES = {
  financial_report: [
    "营业收入",
    "净利润",
    "现金流",
    "资产负债",
    "毛利率",
    "财务报表",
    "revenue",
    "net income",
    "cash flow",
    "balance sheet",
    "gross margin",
  ],
  research_report: [
    "研究报告",
    "行业分析",
    "投资逻辑",
    "市场规模",
    "竞争格局",
    "风险提示",
    "research report",
    "industry analysis",
    "market size",
    "competitive landscape",
    "investment thesis",
  ],
  meeting_notes: [
    "会议纪要",
    "参会人员",
    "会议议程",
    "待办事项",
    "行动项",
    "meeting minutes",
    "attendees",
    "agenda",
    "action items",
  ],
  contract: [
    "合同编号",
    "甲方",
    "乙方",
    "违约责任",
    "争议解决",
    "本协议",
    "agreement",
    "party a",
    "party b",
    "governing law",
    "breach",
  ],
  source_code: [
    "function ",
    "const ",
    "class ",
    "import ",
    "def ",
    "#include",
    "param(",
    "package main",
  ],
  dataset: [
    "record_id",
    "created_at",
    "updated_at",
    "timestamp,",
    "date,amount",
    "日期,金额",
    "编号,名称",
  ],
};

function countOccurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return Math.min(count, 3);
}

export function classifyContent(text, fileName = "") {
  const normalized = text.toLocaleLowerCase();
  const normalizedName = fileName.toLocaleLowerCase();
  const scores = {};
  const matches = {};

  for (const [category, keywords] of Object.entries(RULES)) {
    let score = 0;
    const found = [];
    for (const keyword of keywords) {
      const contentHits = countOccurrences(normalized, keyword);
      if (contentHits > 0) {
        score += contentHits * 2;
        found.push(keyword);
      }
      if (normalizedName.includes(keyword.trim())) score += 0.25;
    }
    scores[category] = score;
    matches[category] = found;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestCategory, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  if (bestScore < 2) {
    return {
      category: "general",
      confidence: 0.25,
      matched_keywords: [],
      scores,
    };
  }

  const confidence = Math.min(
    0.99,
    0.45 + bestScore / (bestScore + 12) + Math.max(0, bestScore - secondScore) / 30,
  );

  return {
    category: bestCategory,
    confidence: Number(confidence.toFixed(2)),
    matched_keywords: matches[bestCategory],
    scores,
  };
}
