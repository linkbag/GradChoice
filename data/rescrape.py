"""
GradChoice Re-scraper — fetch real faculty names for affected departments.

Reads data/rescrape_pairs.json, scrapes university faculty pages, filters
through the blocklist, and inserts clean non-duplicate names into the DB.

Usage:
    cd /path/to/GradChoice
    python3 data/rescrape.py [--dry-run] [--school 清华大学] [--limit 10]

Logs results to data/rescrape_log.json.
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import psycopg2
import requests
from bs4 import BeautifulSoup

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BACKEND_DIR = ROOT / "backend"
PAIRS_FILE = DATA_DIR / "rescrape_pairs.json"
LOG_FILE = DATA_DIR / "rescrape_log.json"

sys.path.insert(0, str(BACKEND_DIR))
from app.utils.name_filter import NameFilter  # noqa: E402

# ── Constants ──────────────────────────────────────────────────────────────
DB_URL = "postgresql://gradchoice:gradchoice_dev@localhost:5432/gradchoice"
USER_AGENT = "GradChoice-DataImport/1.0 (research; open-source)"
REQUEST_DELAY = 2.0  # seconds between pairs
PROBE_DELAY = 0.15   # seconds between URL probes within a pair

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── University domain + department subdomain map ───────────────────────────
# Format: school_name → { domain, dept_subdomains: {dept → subdomain_prefix} }
UNIVERSITY_CONFIG: dict[str, dict] = {
    "清华大学": {
        "domain": "tsinghua.edu.cn",
        "dept_subdomains": {
            "土木水利学院": "civil",
            "环境学院": "env",
            "机械工程系": "me",
            "精密仪器系": "pi",
            "工业工程系": "ie",
            "航天航空学院": "hy",
            "电子工程系": "ee",
            "计算机科学与技术系": "cs",
            "自动化系": "au",
            "集成电路学院": "ic",
            "材料学院": "mse",
            "电机工程与应用电子技术系": "eea",
            "化学工程系": "chemeng",
            "核能与新能源技术研究院": "inet",
            "数学科学系": "math",
            "化学系": "chem",
            "生物医学工程系": "bme",
            "天文系": "astro",
            "经济管理学院": "sem",
            "法学院": "law",
            "生命科学学院": "life",
            "社会科学学院": "sss",
            "全球创新学院": "gia",
            "丘成桐数学科学中心": "ymsc",
            "医学院": "medicine",
            "工程物理系": "engphys",
        },
    },
    "吉林大学": {
        "domain": "jlu.edu.cn",
        "dept_subdomains": {
            "哲学社会学院": "zheshe",
            "体育学院": "tiyuy",
            "经济学院": "economy",
            "法学院": "law",
            "行政学院": "gcpa",
            "商学与管理学院": "bms",
            "数学学院": "math",
            "物理学院": "wuli",
            "药学院": "pharmacy",
            "化学学院": "chem",
            "生命科学学院": "bio",
            "机械与航空航天工程学院": "mae",
            "汽车工程学院": "auto",
            "电气工程学院": "ee",
            "环境与资源学院": "cer",
            "材料科学与工程学院": "mse",
            "化学工程学院": "chemsci",
            "公共卫生学院": "publichealth",
            "护理学院": "nursing",
            "动物科学学院": "animal",
            "食品科学与工程学院": "food",
            "人工智能学院": "ai",
            "国际语言学院": "jluil",
            "超硬材料研究所": "sgmi",
            "文学院": "wxy",
            "考古学院": "archae",
            "历史文化学院": "history",
            "马克思主义学院": "marx",
            "建设工程学院": "cce",
        },
    },
    "哈尔滨工业大学": {
        "domain": "hit.edu.cn",
        "dept_subdomains": {
            "电子与信息工程学院": "ei",
            "计算学部": "cs",
            "航天学院": "aero",
            "人文社科与法学学院": "sg",
            "马克思主义学院": "marx",
            "电气工程及自动化学院": "eea",
            "土木工程学院": "civil",
            "化工与化学学院": "cc",
            "机电工程学院": "mech",
            "材料科学与工程学院": "mse",
            "软件学院": "sa",
            "生命科学与技术学院": "life",
        },
    },
    "华中科技大学": {
        "domain": "hust.edu.cn",
        "dept_subdomains": {
            "生命科学与技术学院": "life",
            "人工智能与自动化学院": "aia",
            "数学与统计学院": "math",
            "机械科学与工程学院": "mse",
            "能源与动力工程学院": "energy",
            "光学与电子信息学院": "oei",
            "电气与电子工程学院": "seee",
        },
    },
    "兰州大学": {
        "domain": "lzu.edu.cn",
        "dept_subdomains": {
            "物理科学与技术学院": "physics",
            "土木工程与力学学院": "civil",
            "法学院": "law",
            "政治与国际关系学院": "sirs",
            "基础医学院": "medicine",
            "材料与能源学院": "mse",
        },
    },
    "南京大学": {
        "domain": "nju.edu.cn",
        "dept_subdomains": {
            "外国语学院": "fl",
            "计算机学院": "cs",
            "天文与空间科学学院": "astronomy",
            "环境学院": "env",
            "建筑与城市规划学院": "arch",
        },
    },
    "东北大学": {
        "domain": "neu.edu.cn",
        "dept_subdomains": {
            "信息科学与工程学院": "ise",
            "医学与生物信息工程学院": "bme",
            "机器人科学与工程学院": "ise",
            "工商管理学院": "sba",
            "理学院": "science",
        },
    },
    "南开大学": {
        "domain": "nankai.edu.cn",
        "dept_subdomains": {
            "环境科学与工程学院": "env",
            "医学院": "medicine",
            "计算机学院": "cc",
            "密码与网络空间安全学院": "cyber",
            "软件学院": "software",
        },
    },
    "西北工业大学": {
        "domain": "nwpu.edu.cn",
        "dept_subdomains": {
            "计算机学院": "cs",
            "软件学院": "soft",
            "机电学院": "me",
            "生命学院": "life",
        },
    },
    "浙江大学": {
        "domain": "zju.edu.cn",
        "dept_subdomains": {
            "信息与电子工程学院": "isee",
            "网络空间安全学院": "icsr",
            "经济学院": "economics",
            "海洋学院": "ocean",
        },
    },
    "北京协和医学院": {
        "domain": "pumc.edu.cn",
        "dept_subdomains": {
            "基础医学研究所": "ibms",
            "护理学院": "nursing",
            "公共卫生学院": "sph",
            "医学人文学院": "humanities",
        },
    },
    "中国矿业大学(北京)": {
        "domain": "cumtb.edu.cn",
        "dept_subdomains": {
            "应急管理与安全工程学院": "em",
            "文法学院": "wf",
            "马克思主义学院": "marx",
            "化学与环境工程学院": "cee",
            "力学与土木工程学院": "ce",
            "能源与矿业学院": "em2",
            "管理学院": "glxy",
            "机械与电气工程学院": "mee",
            "人工智能学院": "ai",
            "理学院": "sci",
        },
    },
    "四川大学": {
        "domain": "scu.edu.cn",
        "dept_subdomains": {},
    },
    "上海交通大学": {
        "domain": "sjtu.edu.cn",
        "dept_subdomains": {
            "安泰经济与管理学院": "acem",
            "生物医学工程学院": "bme",
            "生命科学技术学院": "life",
            "药学院": "pharmacy",
            "船舶海洋与建筑工程学院": "na",
            "国际与公共事务学院": "igpa",
            "中法工程师学院": "sfc",
            "材料科学与工程学院": "mse",
        },
    },
    "中国人民大学": {
        "domain": "ruc.edu.cn",
        "dept_subdomains": {
            "历史学院": "history",
        },
    },
    "北京航空航天大学": {
        "domain": "buaa.edu.cn",
        "dept_subdomains": {
            "计算机学院": "scse",
            "航空发动机研究院": "aeria",
        },
    },
    "北京理工大学": {
        "domain": "bit.edu.cn",
        "dept_subdomains": {
            "外国语学院": "sfl",
            "设计与艺术学院": "da",
            "前沿交叉科学研究院": "iacs",
        },
    },
    "中国地质大学(武汉)": {
        "domain": "cug.edu.cn",
        "dept_subdomains": {
            "资源学院": "resources",
            "工程学院": "eng",
            "地球物理与空间信息学院": "sgeophysics",
        },
    },
    "中国石油大学(华东)": {
        "domain": "upc.edu.cn",
        "dept_subdomains": {
            "机电工程学院": "mee",
            "储运与建筑工程学院": "sbe",
            "地球科学与技术学院": "geosciences",
            "化学化工学院": "chemistry",
            "材料科学与工程学院": "mse",
            "新能源学院": "newenergy",
            "海洋与空间信息学院": "msi",
            "计算机科学与技术学院": "cs",
            "理学院": "sci",
            "经济管理学院": "em",
            "外国语学院": "fl",
            "文法学院": "law",
            "马克思主义学院": "marx",
            "体育教学部": "sports",
            "深层油气全国重点实验室": "deepoil",
            "研究生导师": "",
        },
    },
    "哈尔滨医科大学": {
        "domain": "hrbmu.edu.cn",
        "dept_subdomains": {},
    },
    "东北师范大学": {
        "domain": "nenu.edu.cn",
        "dept_subdomains": {
            "音乐学院": "music",
            "传媒科学学院": "comm",
        },
    },
    "华东师范大学": {
        "domain": "ecnu.edu.cn",
        "dept_subdomains": {
            "经济与管理学院": "sem",
            "地理科学学院": "geo",
        },
    },
    "湖南大学": {
        "domain": "hnu.edu.cn",
        "dept_subdomains": {
            "物理与微电子科学学院": "physics",
        },
    },
}

# Faculty page URL suffix patterns to try per department (in order, most common first)
FACULTY_URL_SUFFIXES = [
    "/szdw.htm",
    "/szll.htm",
    "/szdw/",
    "/szll/",
    "/jsdw.htm",
    "/jsdw/",
    "/szdw/index.htm",
    "/faculty/",
    "/index/szdw.htm",
]

# Regex patterns to extract CJK names (2-4 chars typical for Chinese names)
# Name is typically 2-4 CJK characters
NAME_PATTERN = re.compile(r"^[\u4e00-\u9fff]{2,4}$")
# CJK chars followed by optional short title
NAME_WITH_TITLE_PATTERN = re.compile(
    r"^([\u4e00-\u9fff]{2,4})\s*[（(]?(?:教授|副教授|讲师|研究员|副研究员|助理教授|助教)?[)）]?\s*$"
)

# Navigation/category terms that are definitely NOT names (4 CJK chars that look name-like)
# These appear as nav links on nearly all Chinese university sites
NAV_TERMS: set[str] = {
    # 4-char admin/nav
    "研究项目", "最新论著", "教学团队", "常用链接", "企业委托", "群团工作", "教学资源",
    "党的建设", "支部建设", "学习教育", "学院简介", "专业介绍", "学术动态", "科研成果",
    "新闻动态", "通知公告", "招生信息", "就业信息", "对外合作", "学生工作", "研究生院",
    "本科生院", "研究所简", "实验室简", "人才培养", "教师队伍", "当前位置", "网站地图",
    "联系我们", "意见反馈", "返回顶部", "历史沿革", "组织机构", "规章制度", "下载中心",
    "相关链接", "学院动态", "党政工作", "院系动态", "友情链接", "版权所有",
    "师资队伍", "师资力量", "学科建设", "科研平台", "交流合作", "社会服务",
    "学院概况", "人才招聘", "成果转化", "校友工作", "教职工作", "学术交流",
    "科学研究", "教育教学", "实验室建", "国际合作", "科研平台", "学术报告",
    # 3-char nav/category
    "学术信息", "新闻信息", "师德监督", "合作联盟", "科研项目", "校友风采",
    "毕业设计", "培养方案", "教学展览", "准聘助理", "实验室", "双学位",
    "学术报告", "新闻稿件", "网上办事", "邮件服务", "校历下载", "信息公开",
    "部门介绍", "机构设置", "教务系统", "图书馆", "研究生", "本科生",
    "在线服务", "院务公开", "学术会议", "学位论文", "科研项目", "项目申报",
    # 2-char nav (very common short nav links)
    "简介", "概况", "通知", "公告", "新闻", "动态",
    "更多", "详情", "查看", "返回", "确定", "提交", "搜索", "登录",
    "注册", "首页", "主页", "关于", "联系", "下载", "上传", "设置",
    "帮助", "退出", "返回", "跳过", "编辑", "删除", "添加", "修改",
    "菜单", "导航", "分类", "标签", "归档", "评论", "订阅", "分享",
    # Recruitment/HR & mentor listings
    "人事招聘", "人才招聘", "招聘启事", "就业指导", "学生就业",
    "导师风采", "导师简介", "导师介绍", "导师名录", "导师列表",
    # Institution names that could be mistaken as names
    "南京大学", "清华大学", "北京大学", "吉林大学", "浙江大学", "湖南大学",
    "东北大学", "哈工大学", "南开大学", "西北工业", "上海交通",
}

# Profile URL hints — hrefs with these patterns are likely faculty profiles
PROFILE_HREF_PATTERNS = [
    re.compile(r"[?&]id=\d+"),           # ?id=123
    re.compile(r"/\d{3,}\.htm"),          # /12345.htm
    re.compile(r"/szdw/\w+/"),            # /szdw/xxx/ (sub-path)
    re.compile(r"teacher|faculty|people|staff|tutor|person", re.I),
    re.compile(r"/[a-zA-Z0-9_-]+\.html?$"),  # /name.html profile page
]

# Navigation href patterns — if href matches these, it's NOT a profile
NAV_HREF_PATTERNS = [
    re.compile(r"^#"),                    # anchor
    re.compile(r"^/$"),                   # root
    re.compile(r"/(szdw|szll|jsdw|fzjs|jsmd|index|about|news|research|teaching)/?$"),
    re.compile(r"\.(jpg|png|gif|pdf)$", re.I),
]


# ── HTTP helpers ───────────────────────────────────────────────────────────

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
    })
    return s


def fetch_url(session: requests.Session, url: str, timeout: int = 8) -> Optional[str]:
    """Fetch URL, return HTML or None on error."""
    try:
        resp = session.get(url, timeout=timeout, allow_redirects=True)
        if resp.status_code == 200:
            resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text
        elif resp.status_code in (403, 429):
            log.warning(f"  Rate limited / forbidden: {url} ({resp.status_code})")
        else:
            log.debug(f"  HTTP {resp.status_code}: {url}")
    except requests.exceptions.SSLError:
        # Try http:// fallback
        http_url = url.replace("https://", "http://")
        try:
            resp = session.get(http_url, timeout=timeout, allow_redirects=True, verify=False)
            if resp.status_code == 200:
                resp.encoding = resp.apparent_encoding or "utf-8"
                return resp.text
        except Exception:
            pass
    except requests.exceptions.ConnectionError:
        log.debug(f"  Connection error: {url}")
    except requests.exceptions.Timeout:
        log.debug(f"  Timeout: {url}")
    except Exception as e:
        log.debug(f"  Error fetching {url}: {e}")
    return None


# ── Name extraction ────────────────────────────────────────────────────────

TITLE_SUFFIXES_FOR_STRIP = [
    "博士生导师", "硕士生导师", "博导", "硕导",
    "副教授", "教授", "讲师", "研究员", "副研究员",
    "助理教授", "助教", "助理研究员",
]


def _strip_title(text: str) -> str:
    """Strip academic title from end of text."""
    for suffix in TITLE_SUFFIXES_FOR_STRIP:
        if text.endswith(suffix) and len(text) > len(suffix):
            remainder = text[: -len(suffix)].strip()
            if len(remainder) >= 2:
                return remainder
    return text


def _is_nav_href(href: str) -> bool:
    """Return True if href looks like a navigation link (not a profile)."""
    if not href:
        return True
    for pat in NAV_HREF_PATTERNS:
        if pat.search(href):
            return True
    return False


def _is_profile_href(href: str) -> bool:
    """Return True if href looks like a faculty profile page."""
    if not href or href.startswith("#") or not href.strip("/"):
        return False
    for pat in PROFILE_HREF_PATTERNS:
        if pat.search(href):
            return True
    return False


# Characters that indicate an organizational/institutional name rather than a person
INSTITUTION_SUFFIXES_RE = re.compile(
    r"(大学|学院|学校|研究所|研究院|研究中心|中心|实验室|系部|学部|研究室)$"
)
# Words that appear in the middle/end of non-name strings (expanded)
NON_NAME_SUBSTRINGS = re.compile(
    r"(信息|监督|新闻|公告|管理|服务|系统|平台|工作|教育|培养|基础|联系|版权|下载"
    r"|刊物|机构|动态|时间|伙伴|领导|项目|资料|资源|建设|成果|发展|推进|会议"
    r"|建立|介绍|概况|推荐|通道|在线|查询|申请|报名|办理|网站|邮箱|招聘"
    r"|实验|基地|基金|合作|协作|交流|分享|案例|讨论|答疑|辅导|指导|规划)"
)

# Most common Chinese surnames — if a 3-char "name" starts with none of these,
# it's likely a category/phrase, not a person's name.
COMMON_SURNAMES: set[str] = {
    "张", "王", "李", "刘", "陈", "杨", "黄", "赵", "周", "吴",
    "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
    "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧",
    "程", "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕",
    "苏", "卢", "蒋", "蔡", "贾", "丁", "魏", "薛", "叶", "阎",
    "余", "潘", "杜", "戴", "夏", "钟", "汪", "田", "任", "姜",
    "范", "方", "石", "姚", "谭", "廖", "邹", "熊", "金", "陆",
    "郝", "孔", "白", "崔", "康", "毛", "邱", "秦", "江", "史",
    "顾", "侯", "邵", "孟", "龙", "万", "段", "钱", "汤", "尹",
    "黎", "易", "常", "武", "乔", "贺", "赖", "龚", "文", "柳",
    "关", "穆", "庞", "阮", "华", "费", "符", "喻", "施", "肖",
    "俞", "鲁", "翁", "单", "顾", "章", "纪", "严", "韦", "管",
    "伍", "丘", "骆", "付", "丰", "包", "葛", "洪", "党", "汲",
    "闫", "靳", "申", "宁", "贲", "仲", "桂", "冷", "焦", "路",
    "冉", "晋", "苗", "房", "艾", "牛", "宫", "赫", "邢", "权",
    "裴", "商", "褚", "卫", "向", "秘", "车", "匡", "宦", "云",
    "亓", "弓", "牟", "赏", "谷", "禹", "翟", "班", "赏", "耿",
    # Less common but real surnames for ethnic groups:
    "乌", "巴", "那", "阿", "特", "布", "孛", "额",
}


def _candidate_name(text: str, require_surname: bool = False) -> Optional[str]:
    """
    Check if text looks like a Chinese personal name.
    Returns cleaned name or None.

    Args:
        require_surname: if True, require first char to be a known surname.
                         Use this for lower-confidence extraction contexts.
    """
    if not text:
        return None
    text = text.strip()
    text = _strip_title(text)
    text = text.strip()

    # Must be 2-4 CJK characters (no mixed scripts)
    if not NAME_PATTERN.match(text):
        return None

    # Must not be a known navigation/category term
    if text in NAV_TERMS:
        return None

    # Must not look like an institution name
    if INSTITUTION_SUFFIXES_RE.search(text):
        return None

    # 3-4 char items with non-name substrings are likely category labels
    if len(text) >= 3 and NON_NAME_SUBSTRINGS.search(text):
        return None

    # In low-confidence contexts, require known surname for 2-4 char items
    if require_surname and text[0] not in COMMON_SURNAMES:
        return None

    return text


EXCLUDED_ANCESTOR_TAGS = frozenset(["nav", "header", "footer"])
EXCLUDED_ANCESTOR_CLASSES = re.compile(
    r"(nav|menu|sidebar|header|footer|top-bar|breadcrumb|crumb|banner|copyright)",
    re.I,
)
FACULTY_SECTION_RE = re.compile(
    r"(师资队伍|师资力量|师资名录|教师名录|全体教师|全部教师|导师名单|导师列表"
    r"|教学人员|教职人员|本院教师|szdw|jsdw|jxry|szll)",
    re.I,
)


def _in_nav_area(elem) -> bool:
    """Return True if elem is inside a navigation/header/footer area."""
    parent = getattr(elem, "parent", None)
    depth = 0
    while parent and depth < 8:
        tag = getattr(parent, "name", "") or ""
        if tag in EXCLUDED_ANCESTOR_TAGS:
            return True
        classes = " ".join(parent.get("class", []))
        if EXCLUDED_ANCESTOR_CLASSES.search(classes):
            return True
        pid = (parent.get("id") or "")
        if EXCLUDED_ANCESTOR_CLASSES.search(pid):
            return True
        parent = getattr(parent, "parent", None)
        depth += 1
    return False


def extract_names_from_html(html: str, school_name: str, department: str) -> list[str]:
    """
    Extract faculty names from HTML using context-aware strategies.

    Priority order:
    1. Profile-href links — most precise signal
    2. Faculty section containers — headings/IDs indicating faculty area
    3. Table cells in faculty context
    4. Class-name based extraction
    5. Last resort: high-density clusters of 2-3 char links
    """
    soup = BeautifulSoup(html, "html.parser")
    names: set[str] = set()

    # ── Strategy 1: Profile-href links ────────────────────────────────────
    # Links whose href looks like a faculty profile page — most reliable signal
    for a in soup.find_all("a"):
        if _in_nav_area(a):
            continue
        href = a.get("href", "") or ""
        if not _is_profile_href(href):
            continue
        # Profile links: require surname for 2-char names to avoid "更多", "详情"
        text = _candidate_name(a.get_text(strip=True) or "", require_surname=True)
        if text:
            names.add(text)

    # ── Strategy 2: Faculty section container ─────────────────────────────
    # Find sections explicitly labeled as faculty listings
    # Look for containers whose id/class or nearby heading mentions faculty
    def find_faculty_container():
        # By id/class on the container itself
        for elem in soup.find_all(id=FACULTY_SECTION_RE):
            yield elem
        for elem in soup.find_all(class_=FACULTY_SECTION_RE):
            yield elem
        # By preceding heading text
        for heading in soup.find_all(["h1", "h2", "h3", "h4", "h5"]):
            if FACULTY_SECTION_RE.search(heading.get_text()):
                # Return the heading's parent as the container
                yield heading.parent
                # Also try the next sibling container
                nxt = heading.find_next_sibling(["div", "ul", "table", "section"])
                if nxt:
                    yield nxt

    for container in find_faculty_container():
        if container is None:
            continue
        for a in container.find_all("a"):
            text = _candidate_name(a.get_text(strip=True) or "", require_surname=True)
            if text:
                names.add(text)
        for cell in container.find_all(["td", "li", "span", "p"]):
            # Only direct text (no nested tags adding noise)
            direct_text = "".join(
                str(c) for c in cell.children if isinstance(c, str)
            ).strip()
            text = _candidate_name(
                direct_text or cell.get_text(strip=True), require_surname=True
            )
            if text:
                names.add(text)

    # ── Strategy 3: Table cells in faculty context ─────────────────────────
    FACULTY_TABLE_RE = re.compile(r"(师资|教师|导师|教职|faculty|teacher|staff)", re.I)
    if not names:
        for table in soup.find_all("table"):
            if _in_nav_area(table):
                continue
            # Check if this table is in a faculty context
            prev_heading = table.find_previous(["h1", "h2", "h3", "h4"])
            nearby_text = (prev_heading.get_text() if prev_heading else "") + table.get_text()[:300]
            if not FACULTY_TABLE_RE.search(nearby_text):
                continue
            for cell in table.find_all(["td", "th"]):
                text = _candidate_name(cell.get_text(strip=True) or "")
                if text:
                    names.add(text)

    # ── Strategy 4: Class-name elements ───────────────────────────────────
    CLASS_NAME_RE = re.compile(r"(^|[- _])(name|xm|jsxm|jsmc|jsmingcheng)([- _]|$)", re.I)
    for elem in soup.find_all(class_=True):
        if _in_nav_area(elem):
            continue
        classes = " ".join(elem.get("class", []))
        if CLASS_NAME_RE.search(classes):
            text = _candidate_name(elem.get_text(strip=True) or "")
            if text:
                names.add(text)

    # ── Strategy 5: High-density cluster of 2-3 char links ────────────────
    # Only if nothing found yet. Chinese names are usually 2-3 chars.
    # 4-char items are commonly navigation — so prefer 2-3 char clusters.
    if not names:
        # Group short-name links by their direct parent (more granular)
        from collections import defaultdict
        parent_links: dict = defaultdict(list)

        for a in soup.find_all("a"):
            if _in_nav_area(a):
                continue
            href = a.get("href", "") or ""
            if _is_nav_href(href):
                continue
            text = _candidate_name(a.get_text(strip=True) or "")
            if not text:
                continue
            # Walk up to nearest block container
            parent = a.parent
            for _ in range(4):
                if parent is None:
                    break
                tag = getattr(parent, "name", "")
                if tag in ("div", "ul", "section", "table", "article", "main"):
                    break
                parent = getattr(parent, "parent", None)
            if parent:
                parent_links[id(parent)].append((text, href))

        # Find the largest cluster of 2-3 char names (avoid 4-char nav clusters)
        best_cluster: list[str] = []
        for pid, items in parent_links.items():
            # Prefer clusters where first chars are mostly common surnames
            surname_matches = [t for t, _ in items if t[0] in COMMON_SURNAMES]
            if len(surname_matches) >= 5 and len(surname_matches) > len(best_cluster):
                best_cluster = [t for t, _ in items]

        names.update(best_cluster)

    return list(names)


# ── URL building ───────────────────────────────────────────────────────────

def build_candidate_urls(school_name: str, department: str) -> list[str]:
    """Build list of candidate faculty page URLs to try."""
    config = UNIVERSITY_CONFIG.get(school_name)
    if not config:
        return []

    domain = config["domain"]
    subdomain = config.get("dept_subdomains", {}).get(department)
    urls = []

    if subdomain:
        base = f"https://{subdomain}.{domain}"
        for suffix in FACULTY_URL_SUFFIXES:
            urls.append(base + suffix)
        # Also try with www prefix
        urls.append(f"https://www.{subdomain}.{domain}/szdw.htm")
        urls.append(f"https://www.{subdomain}.{domain}/szdw/")

    # Always try main site with department path hints
    dept_keywords = {
        "计算机": ["cs", "jsjxy", "computer"],
        "机械": ["me", "jxxy", "mech"],
        "电气": ["ee", "dqxy"],
        "材料": ["mse", "clxy"],
        "环境": ["env", "hjxy"],
        "化学": ["chem", "hxxy"],
        "数学": ["math", "sxxy"],
        "物理": ["physics", "wlxy"],
        "生命": ["life", "smxy"],
        "医学": ["med", "yxxy"],
        "经济": ["econ", "jjxy"],
        "法学": ["law", "fxxy"],
        "外语": ["fl", "wyxy"],
        "马克思": ["marx", "mkszy"],
    }

    return urls


FACULTY_LINK_KEYWORDS = re.compile(
    r"(师资|教师|教职|导师|szdw|jsdw|szll|jxry|fzjs|jsmd|faculty|teacher|staff)",
    re.I,
)

# Domain-level reachability cache: domain → bool
_domain_reachable: dict[str, bool] = {}


def _check_domain_reachable(session: requests.Session, domain: str, subdomain: str) -> bool:
    """Quick check if a subdomain is reachable. Cache results."""
    cache_key = f"{subdomain}.{domain}"
    if cache_key in _domain_reachable:
        return _domain_reachable[cache_key]

    test_url = f"https://{cache_key}/"
    try:
        resp = session.get(test_url, timeout=5, allow_redirects=True)
        reachable = resp.status_code < 500
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        reachable = False
    except Exception:
        reachable = False

    _domain_reachable[cache_key] = reachable
    log.debug(f"  Domain {cache_key}: {'reachable' if reachable else 'unreachable'}")
    return reachable


def find_faculty_page(
    session: requests.Session,
    school_name: str,
    department: str,
) -> tuple[Optional[str], Optional[str]]:
    """
    Find faculty page by:
    1. Quick domain reachability check
    2. Try known URL suffix patterns on the department subdomain
    3. If that fails, fetch the main page and follow faculty-related links

    Returns (html, url) or (None, None).
    """
    config = UNIVERSITY_CONFIG.get(school_name)
    if not config:
        log.debug(f"  No URL config for {school_name}")
        return None, None

    domain = config["domain"]
    subdomain = config.get("dept_subdomains", {}).get(department)
    if not subdomain:
        log.debug(f"  No subdomain mapping for {school_name}/{department}")
        return None, None

    # ── Quick domain reachability check ───────────────────────────────────
    if not _check_domain_reachable(session, domain, subdomain):
        log.info(f"  Domain {subdomain}.{domain} unreachable — skipping")
        return None, None

    base_url = f"https://{subdomain}.{domain}"

    # ── Phase 1: Try direct URL suffix patterns ───────────────────────────
    for suffix in FACULTY_URL_SUFFIXES:
        url = base_url + suffix
        time.sleep(PROBE_DELAY)
        html = fetch_url(session, url)
        if html and _has_enough_cjk(html, min_chars=100):
            log.info(f"  Found faculty page: {url}")
            return html, url

    # ── Phase 2: Fetch main page, follow faculty links ────────────────────
    main_html = fetch_url(session, base_url)
    if not main_html:
        main_html = fetch_url(session, base_url + "/index.htm")
    if not main_html:
        return None, None

    # Find faculty-related links on the main page
    soup = BeautifulSoup(main_html, "html.parser")
    candidate_hrefs: list[str] = []

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        link_text = a.get_text(strip=True)
        # Check if link text or href mentions faculty/teachers
        if FACULTY_LINK_KEYWORDS.search(href) or FACULTY_LINK_KEYWORDS.search(link_text):
            # Make absolute URL
            abs_href = urljoin(base_url, href)
            # Only follow links on the same domain
            if domain in abs_href and abs_href not in candidate_hrefs:
                candidate_hrefs.append(abs_href)

    log.debug(f"  Found {len(candidate_hrefs)} candidate faculty links on main page")

    for cand_url in candidate_hrefs[:6]:  # try up to 6 candidate links
        time.sleep(PROBE_DELAY)
        html = fetch_url(session, cand_url)
        if html and _has_enough_cjk(html, min_chars=100):
            log.info(f"  Found faculty page via main-page link: {cand_url}")
            return html, cand_url

    return None, None


def _has_enough_cjk(html: str, min_chars: int = 100) -> bool:
    """Check if HTML has enough CJK content to be a real faculty page."""
    cjk_count = sum(1 for c in html if "\u4e00" <= c <= "\u9fff")
    return cjk_count >= min_chars


# ── Harbin Medical University special handling ─────────────────────────────

def parse_harbin_medical_dept(department: str) -> tuple[str, str]:
    """
    Parse '哈尔滨医科大学卫生管理学院-博导' → ('卫生管理学院', '博导')
    Returns (college_name, type_label).
    """
    # Remove school prefix
    dept = department
    for prefix in ["哈尔滨医科大学", "哈医大"]:
        if dept.startswith(prefix):
            dept = dept[len(prefix):]
            break
    # Split on '-'
    if "-" in dept:
        parts = dept.split("-", 1)
        return parts[0].strip(), parts[1].strip()
    return dept.strip(), ""


HARBIN_MEDICAL_COLLEGE_URLS: dict[str, str] = {
    "卫生管理学院": "https://sph.hrbmu.edu.cn/szdw/",
    "基础医学院": "https://jcyx.hrbmu.edu.cn/szdw/",
    "药学院": "https://pharmacy.hrbmu.edu.cn/szdw/",
    "护理学院": "https://nursing.hrbmu.edu.cn/szdw/",
    "生物信息学院": "https://bio.hrbmu.edu.cn/szdw/",
    "医工交叉学院": "https://www.hrbmu.edu.cn/yjjcxy/szdw/",
}

SICHUAN_HUAXI_URLS: dict[str, str] = {
    "华西医院": "https://www.cd120.com/zl/",  # fallback — actual HUST hospital
}


# ── DB helpers ─────────────────────────────────────────────────────────────

def get_db_connection():
    return psycopg2.connect(DB_URL)


def check_existing(conn, name: str, school_code: str, department: str) -> bool:
    """Return True if supervisor already in DB."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM supervisors
            WHERE name = %s AND school_code = %s AND department = %s
            LIMIT 1
            """,
            (name, school_code, department),
        )
        return cur.fetchone() is not None


def insert_supervisor(
    conn,
    name: str,
    school_name: str,
    school_code: str,
    province: str,
    department: str,
    title: Optional[str] = None,
    webpage_url: Optional[str] = None,
    dry_run: bool = False,
) -> bool:
    """Insert a new supervisor. Returns True if inserted."""
    if dry_run:
        log.info(f"    [DRY RUN] Would insert: {name} | {school_name} | {department}")
        return True

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO supervisors
                    (id, school_code, school_name, province, name, department,
                     title, webpage_url_1, avg_overall_score, rating_count,
                     verified_avg_overall_score, verified_rating_count,
                     created_at, updated_at)
                VALUES
                    (%s, %s, %s, %s, %s, %s,
                     %s, %s, NULL, 0, NULL, 0,
                     %s, %s)
                ON CONFLICT (school_code, name, department) DO NOTHING
                """,
                (
                    str(uuid.uuid4()),
                    school_code,
                    school_name,
                    province,
                    name,
                    department,
                    title,
                    webpage_url,
                    datetime.now(timezone.utc),
                    datetime.now(timezone.utc),
                ),
            )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        log.error(f"    DB insert error for {name}: {e}")
        return False


# ── Main scraping logic ────────────────────────────────────────────────────

def process_pair(
    session: requests.Session,
    conn,
    name_filter: NameFilter,
    pair: dict,
    dry_run: bool = False,
) -> dict:
    """Process a single (school, dept) pair. Returns stats dict."""
    school_name = pair["school_name"]
    school_code = pair["school_code"]
    province = pair["province"]
    department = pair["department"]

    stats = {
        "scraped": 0,
        "blocked": 0,
        "duplicates": 0,
        "new": 0,
        "url": None,
        "error": None,
    }

    log.info(f"Processing: {school_name} / {department}")

    # Special handling for Harbin Medical University
    if school_name == "哈尔滨医科大学":
        college_name, type_label = parse_harbin_medical_dept(department)
        url = HARBIN_MEDICAL_COLLEGE_URLS.get(college_name)
        if not url:
            log.warning(f"  No URL mapping for 哈尔滨医科大学 / {college_name}")
            stats["error"] = f"no_url_for_{college_name}"
            return stats

        html = fetch_url(session, url)
        if not html:
            url2 = url.rstrip("/")
            html = fetch_url(session, url2)
        time.sleep(REQUEST_DELAY)

    # Special handling for 四川大学 华西医院 departments
    elif school_name == "四川大学" and "华西" in department:
        log.info(f"  Skipping 四川大学华西医院 subdepartment (no public faculty listing)")
        stats["error"] = "no_public_faculty_listing"
        return stats

    # Special handling for 中国石油大学 研究生导师
    elif department == "研究生导师":
        log.info(f"  Skipping generic '研究生导师' department")
        stats["error"] = "generic_dept_skip"
        return stats

    else:
        html, url = find_faculty_page(session, school_name, department)
        if not html:
            time.sleep(1.0)  # shorter delay on miss
        else:
            time.sleep(REQUEST_DELAY)

        if not html:
            log.warning(f"  Could not find faculty page for {school_name} / {department}")
            stats["error"] = "page_not_found"
            return stats

    if not html:
        stats["error"] = "fetch_failed"
        return stats

    stats["url"] = url

    # Extract names
    raw_names = extract_names_from_html(html, school_name, department)
    log.info(f"  Extracted {len(raw_names)} raw names from {url}")
    stats["scraped"] = len(raw_names)

    # Filter and insert
    for raw_name in raw_names:
        cleaned, reason = name_filter.clean_name(raw_name)
        if cleaned is None:
            log.debug(f"    BLOCKED: {raw_name!r} — {reason}")
            stats["blocked"] += 1
            continue

        if check_existing(conn, cleaned, school_code, department):
            stats["duplicates"] += 1
            continue

        ok = insert_supervisor(
            conn,
            name=cleaned,
            school_name=school_name,
            school_code=school_code,
            province=province,
            department=department,
            dry_run=dry_run,
        )
        if ok:
            log.info(f"    NEW: {cleaned}")
            stats["new"] += 1

    return stats


# ── XLSX/CSV update ────────────────────────────────────────────────────────

def append_to_master_files(new_rows: list[dict]) -> None:
    """Append newly scraped names to MASTER_ALL_90HEI_TUTORS_CLEAN.xlsx and .csv."""
    if not new_rows:
        log.info("No new rows to append to master files.")
        return

    import pandas as pd

    master_dir = Path("/mnt/d/Startup projects/cn-grad-units")
    xlsx_path = master_dir / "MASTER_ALL_90HEI_TUTORS_CLEAN.xlsx"
    csv_path = master_dir / "MASTER_ALL_90HEI_TUTORS_CLEAN.csv"

    new_df = pd.DataFrame(new_rows)

    for path in [xlsx_path, csv_path]:
        if not path.exists():
            log.warning(f"Master file not found: {path}")
            continue

        try:
            if path.suffix == ".xlsx":
                existing = pd.read_excel(path)
            else:
                existing = pd.read_csv(path, encoding="utf-8-sig")

            # Align columns
            for col in new_df.columns:
                if col not in existing.columns:
                    existing[col] = None

            combined = pd.concat([existing, new_df], ignore_index=True)

            if path.suffix == ".xlsx":
                combined.to_excel(path, index=False)
            else:
                combined.to_csv(path, index=False, encoding="utf-8-sig")

            log.info(f"Updated {path}: {len(existing)} → {len(combined)} rows (+{len(new_df)})")
        except Exception as e:
            log.error(f"Failed to update {path}: {e}")


# ── Entry point ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Re-scrape faculty names for affected departments")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    parser.add_argument("--school", help="Only process this school (e.g. 清华大学)")
    parser.add_argument("--limit", type=int, default=0, help="Process at most N pairs")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load pairs
    pairs = json.loads(PAIRS_FILE.read_text(encoding="utf-8"))
    log.info(f"Loaded {len(pairs)} pairs from {PAIRS_FILE}")

    # Filter by school if requested
    if args.school:
        pairs = [p for p in pairs if p["school_name"] == args.school]
        log.info(f"Filtered to {len(pairs)} pairs for '{args.school}'")

    # Apply limit
    if args.limit:
        pairs = pairs[: args.limit]
        log.info(f"Limited to {args.limit} pairs")

    if not pairs:
        log.error("No pairs to process.")
        sys.exit(1)

    # Initialize components
    name_filter = NameFilter(blocklist_path=DATA_DIR / "blocklist.json")
    session = make_session()

    # Connect to DB
    try:
        conn = get_db_connection()
        log.info("Connected to PostgreSQL")
    except Exception as e:
        log.error(f"DB connection failed: {e}")
        sys.exit(1)

    # Process all pairs
    results_by_school: dict[str, dict] = {}
    total_scraped = 0
    total_blocked = 0
    total_duplicates = 0
    total_new = 0
    total_errors = 0
    all_new_rows: list[dict] = []

    for i, pair in enumerate(pairs):
        school = pair["school_name"]
        dept = pair["department"]

        try:
            stats = process_pair(session, conn, name_filter, pair, dry_run=args.dry_run)
        except KeyboardInterrupt:
            log.info("\nInterrupted by user.")
            break
        except Exception as e:
            log.error(f"Unexpected error for {school}/{dept}: {e}", exc_info=True)
            stats = {"scraped": 0, "blocked": 0, "duplicates": 0, "new": 0, "url": None, "error": str(e)}

        # Accumulate stats
        total_scraped += stats["scraped"]
        total_blocked += stats["blocked"]
        total_duplicates += stats["duplicates"]
        total_new += stats["new"]
        if stats.get("error"):
            total_errors += 1

        if school not in results_by_school:
            results_by_school[school] = {}
        results_by_school[school][dept] = stats

        if args.limit and (i + 1) >= args.limit:
            break

    conn.close()

    # Write log
    log_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dry_run": args.dry_run,
        "total_pairs_processed": len(pairs),
        "total_names_scraped": total_scraped,
        "total_blocked": total_blocked,
        "total_duplicates": total_duplicates,
        "total_new_inserted": total_new,
        "total_errors": total_errors,
        "by_school": results_by_school,
    }
    LOG_FILE.write_text(json.dumps(log_data, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info(f"Log written to {LOG_FILE}")

    # Update master files (if not dry run)
    if not args.dry_run and all_new_rows:
        append_to_master_files(all_new_rows)

    # Print summary
    print("\n" + "=" * 60)
    print("RE-SCRAPE SUMMARY")
    print("=" * 60)
    print(f"Pairs processed : {len(pairs)}")
    print(f"Names scraped   : {total_scraped}")
    print(f"Blocked         : {total_blocked}")
    print(f"Duplicates      : {total_duplicates}")
    print(f"NEW inserted    : {total_new}")
    print(f"Errors/skipped  : {total_errors}")
    print("=" * 60)

    if results_by_school:
        print("\nBy school:")
        for school, depts in sorted(results_by_school.items()):
            school_new = sum(d.get("new", 0) for d in depts.values())
            school_scraped = sum(d.get("scraped", 0) for d in depts.values())
            print(f"  {school}: {school_scraped} scraped, {school_new} new")


if __name__ == "__main__":
    main()
