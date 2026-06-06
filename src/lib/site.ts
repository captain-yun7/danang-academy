// 텍스트는 messages/{locale}.json에서 관리 — 여기는 구조 데이터만.

export const contact = {
  phone: "+84 000 000 0000",
  email: "info@danang-academy.example",
};

export const social = {
  facebook: "https://facebook.com/",
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/",
  youtube: "https://youtube.com/",
  zalo: "https://zalo.me/",
} as const;

export const primaryNavSlugs = [
  { key: "beginner", href: "/courses/beginner" },
  { key: "intermediate", href: "/courses/intermediate" },
  { key: "topik", href: "/courses/topik" },
  { key: "conversation", href: "/courses/conversation" },
] as const;

export const secondaryNavSlugs = [
  { key: "home", href: "/" },
  { key: "about", href: "/about" },
  { key: "teachers", href: "/teachers" },
  { key: "news", href: "/news" },
  { key: "careers", href: "/careers" },
  { key: "contact", href: "/contact" },
] as const;

export const levelKeys = [
  "none",
  "beginner",
  "elementary",
  "intermediate",
  "advanced",
] as const;

// 코스 카탈로그는 DB(course_catalog) 에서 관리 — src/lib/courses.ts 참조.
// 헤더/푸터 네비의 4개 핵심 코스만 primaryNavSlugs 에 별도로 박혀 있음.

export const teachers = [
  { nameKey: "ngoc", name: "Vũ Thị Hồng Ngọc", roleKey: "director", bioKey: "ngoc" },
  { nameKey: "linh", name: "Đặng Hải Linh", roleKey: "intermediate", bioKey: "linh" },
  { nameKey: "huyen", name: "Bùi Thị Huyền", roleKey: "topik", bioKey: "huyen" },
  { nameKey: "huong", name: "Phạm Thanh Hương", roleKey: "conversation", bioKey: "huong" },
  { nameKey: "nam", name: "Trần Hoài Nam", roleKey: "writing", bioKey: "nam" },
  { nameKey: "trang", name: "Lê Minh Trang", roleKey: "junior", bioKey: "trang" },
];

export const activityKeys = [
  "yeungnam", "cau", "silla", "sbs", "school", "culture",
  "chuseok", "hangul", "topik", "corp", "parent", "alumni",
] as const;

export const testimonialKeys = ["r1", "r2", "r3", "r4", "r5", "r6"] as const;
export const testimonialNames: Record<string, string> = {
  r1: "Nguyễn Minh Anh",
  r2: "Trần Thanh Hải",
  r3: "Lê Thị Lan",
  r4: "Phạm Văn Tùng",
  r5: "Đoàn Thu Hà",
  r6: "Hoàng Đức Mạnh",
};

export const newsItems = [
  { key: "n1", date: "2026-04-15" },
  { key: "n2", date: "2026-04-20" },
  { key: "n3", date: "2026-04-10" },
  { key: "n4", date: "2026-04-05" },
];

export const partners = [
  { name: "FPT University", logo: "FPT" },
  { name: "Samsung Vietnam", logo: "SAMSUNG" },
  { name: "LG Electronics", logo: "LG" },
  { name: "영남대학교 / ĐH Yeungnam", logo: "YU" },
  { name: "중앙대학교 / ĐH Chung-Ang", logo: "CAU" },
];

export const adminMenuKeys = [
  { key: "dashboard", href: "/admin" },
  { key: "students", href: "/admin/students" },
  { key: "classes", href: "/admin/classes" },
  { key: "assignments", href: "/admin/assignments" },
  { key: "teachers", href: "/admin/teachers" },
  { key: "attendance", href: "/admin/attendance" },
  { key: "tests", href: "/admin/tests" },
  { key: "mcq", href: "/admin/mcq" },
  { key: "leads", href: "/admin/leads" },
  { key: "courses", href: "/admin/courses" },
  { key: "reports", href: "/admin/reports" },
  { key: "settings", href: "/admin/settings" },
] as const;
