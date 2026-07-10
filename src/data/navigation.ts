export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const mainNav: NavItem[] = [
  { label: '首頁', href: '/' },
  { label: '關於尊茂財務', href: '/about/' },
  {
    label: '服務對象',
    href: '/service-targets/',
    children: [
      { label: '個人財務規劃', href: '/service-targets/personal/' },
      { label: '家庭財務規劃', href: '/service-targets/family/' },
      { label: '公司財務規劃', href: '/service-targets/corporate/' },
      { label: '財富稅務規劃', href: '/service-targets/wealth-tax/' },
    ],
  },
  {
    label: '服務項目',
    href: '/services/',
    children: [
      { label: '理財規劃', href: '/services/financial-planning/' },
      { label: '稅務規劃', href: '/services/tax-planning/' },
      { label: '財富傳承', href: '/services/wealth-inheritance/' },
      { label: '海外銀行開戶', href: '/services/overseas-banking/' },
      { label: '家族治理', href: '/services/family-governance/' },
      { label: '保險服務', href: '/services/insurance/' },
      { label: '信託規劃', href: '/services/trust-planning/' },
      { label: '移民規劃', href: '/services/immigration/' },
      { label: '二代培訓', href: '/services/next-gen-training/' },
      { label: '租稅服務', href: '/services/tax-services/' },
      { label: '地政士服務', href: '/services/land-administration/' },
      { label: '國際貿易', href: '/services/international-trade/' },
      { label: '海外基金債券', href: '/services/overseas-funds/' },
    ],
  },
  { label: '服務流程', href: '/service-process/' },
  { label: '專業團隊', href: '/team/' },
  { label: '最新消息', href: '/news/' },
  { label: '聯絡我們', href: '/contact/' },
];

// 主顧問（作者 E-E-A-T）。所有文章預設掛此人。以下為本人提供之真實資歷。
export const principalAuthor = {
  name: '吳芳圳',
  title: '財務醫師',
  url: '/author/wu-fang-jun/',
  personId: 'https://www.dreamer868.com/author/wu-fang-jun/#person',
  company: '尊茂國際有限公司',
  credential: 'IARFC 國際認證財務規劃師',
  experienceYears: 14,
  roles: [
    '尊茂國際有限公司 負責人',
    '大人物商學院 院長',
    '得勝教練團隊 金融教練',
  ],
  motto: '安全感來自數字，安心感來自財務系統。',
  bio: '吳芳圳，財務醫師，IARFC 國際認證財務規劃師，擁有 14 年以上財務規劃與資產配置實務經驗。現任尊茂國際有限公司負責人、大人物商學院院長、得勝教練團隊金融教練。專注協助企業主、醫師、高資產家庭與專業人士，透過財務規劃、稅務規劃、資產傳承、信託架構、海外公司設立及國際資產配置等工具，建立穩健且能世代延續的財務系統。',
};

export const contactInfo = {
  lineId: 'agu1352u',
  lineUrl: 'https://line.me/R/ti/p/@agu1352u',
  lineQrImage: 'https://qr-official.line.me/gs/M_agu1352u_GW.png?oat_content=qr',
  facebookUrl: 'https://www.facebook.com/profile.php?id=61590731308717&locale=zh_TW',
  phone: '0909-230140',
  email: 'dreamer88888888888@gmail.com',
  taxId: '94163195',
  address: '408 臺中市南屯區文心路一段186號9樓之1',
  googleAnalyticsId: 'G-YE9TBVK70Y',
};