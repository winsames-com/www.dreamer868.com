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

export const contactInfo = {
  lineId: 'irich168',
  lineUrl: 'http://line.naver.jp/ti/p/~irich168',
  phone: '0909-230140',
  email: 'dreamer88888888888@gmail.com',
  taxId: '94163195',
  address: '台中市南屯區向心南路186巷9弄之1',
  googleAnalyticsId: 'G-TT5Y5BH5V2',
};
