export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const mainNav: NavItem[] = [
  { label: '首頁', href: '/' },
  { label: '關於尊茂財務', href: '/about' },
  {
    label: '服務對象',
    href: '/service-targets',
    children: [
      { label: '個人財務規劃', href: '/service-targets/personal' },
      { label: '家庭財務規劃', href: '/service-targets/family' },
      { label: '公司財務規劃', href: '/service-targets/corporate' },
      { label: '財富稅務規劃', href: '/service-targets/wealth-tax' },
    ],
  },
  {
    label: '服務項目',
    href: '/services',
    children: [
      { label: '理財規劃', href: '/services/financial-planning' },
      { label: '稅務規劃', href: '/services/tax-planning' },
      { label: '財富傳承', href: '/services/wealth-inheritance' },
      { label: '海外銀行開戶', href: '/services/overseas-banking' },
      { label: '家族治理', href: '/services/family-governance' },
      { label: '保險服務', href: '/services/insurance' },
      { label: '信託規劃', href: '/services/trust-planning' },
      { label: '移民規劃', href: '/services/immigration' },
      { label: '二代培訓', href: '/services/next-gen-training' },
      { label: '租稅服務', href: '/services/tax-services' },
      { label: '地政士服務', href: '/services/land-administration' },
      { label: '國際貿易', href: '/services/international-trade' },
      { label: '海外基金債券', href: '/services/overseas-funds' },
    ],
  },
  { label: '服務流程', href: '/service-process' },
  { label: '專業團隊', href: '/team' },
  { label: '最新消息', href: '/news' },
  { label: '聯絡我們', href: '/contact' },
];

// 主顧問（作者 E-E-A-T）。所有文章預設掛此人；資料取自站內既有署名與「財務醫生」理念，
// 未填入未經證實的證照/年資。若日後提供 CFP/RFP/年資等可在此補強。
export const principalAuthor = {
  name: '吳芳圳',
  title: '財務醫師',
  url: '/author/wu-fang-jun',
  personId: 'https://www.dreamer868.com/author/wu-fang-jun/#person',
  bio: '吳芳圳，尊茂財務規劃財務醫師。秉持「財務醫生」理念——先替客戶診斷財務體質、再開立合適處方，而非以銷售商品為導向。整合財務顧問、律師、會計師、地政士與海外顧問等跨領域專業，協助個人、家庭與企業在理財、稅務、保險、財富傳承與家族治理等面向，建立安全且能永續的財務架構。',
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