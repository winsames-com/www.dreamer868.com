import { url } from '../utils/url';

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const mainNav: NavItem[] = [
  { label: '首頁', href: url('/') },
  { label: '關於尊茂財務', href: url('/about') },
  {
    label: '服務對象',
    href: url('/service-targets'),
  },
  {
    label: '服務項目',
    href: url('/services'),
    children: [
      { label: '理財規劃', href: url('/services/financial-planning') },
      { label: '稅務規劃', href: url('/services/tax-planning') },
      { label: '財富傳承', href: url('/services/wealth-inheritance') },
      { label: '海外銀行開戶', href: url('/services/overseas-banking') },
      { label: '家族治理', href: url('/services/family-governance') },
      { label: '保險服務', href: url('/services/insurance') },
      { label: '信託規劃', href: url('/services/trust-planning') },
      { label: '移民規劃', href: url('/services/immigration') },
      { label: '二代培訓', href: url('/services/next-gen-training') },
      { label: '租稅服務', href: url('/services/tax-services') },
      { label: '地政士服務', href: url('/services/land-administration') },
      { label: '國際貿易', href: url('/services/international-trade') },
      { label: '海外基金債券', href: url('/services/overseas-funds') },
    ],
  },
  { label: '服務流程', href: url('/service-process') },
  { label: '專業團隊', href: url('/team') },
  { label: '最新消息', href: url('/news') },
  { label: '聯絡我們', href: url('/contact') },
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
