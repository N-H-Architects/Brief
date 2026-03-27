/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, Component } from 'react';
import { 
  User, 
  MapPin, 
  Home, 
  Palette, 
  Wind, 
  Cpu, 
  Compass, 
  DollarSign, 
  Star, 
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Info,
  Layers,
  Upload,
  X,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { auth } from './firebase';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Question {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'checkbox' | 'radio' | 'file';
  options?: string[];
  hint?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  questions: Question[];
  description?: string;
  footerNote?: string;
}

const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* House Outline */}
    <path 
      d="M25 45 L25 85 H75 V45 M25 45 L50 20 L65 35 M75 45 V85" 
      stroke="currentColor" 
      strokeWidth="4" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    {/* The Dot */}
    <circle cx="65" cy="55" r="6" fill="currentColor" />
  </svg>
);

const briefSections: Section[] = [
  {
    id: 'general',
    title: '1. Thông tin chung & Mục tiêu',
    icon: <User className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để thiết lập quy trình làm việc hiệu quả, thấu hiểu mục tiêu cốt lõi và quản trị kỳ vọng của bạn ngay từ giai đoạn khởi đầu.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để thiết lập quy trình làm việc hiệu quả và quản trị kỳ vọng ngay từ đầu.',
    questions: [
      { id: 'g0_1', text: 'Họ và tên khách hàng?', type: 'text' },
      { id: 'g0_2', text: 'Năm sinh?', type: 'text', hint: 'Giúp KTS tư vấn phong thủy và nhân trắc học phù hợp.' },
      { id: 'g1', text: 'Ai là người đưa ra quyết định cuối cùng về thiết kế và ngân sách?', type: 'text', hint: 'Giúp KTS tập trung tư vấn đúng trọng tâm.' },
      { id: 'g2', text: 'Mục tiêu lớn nhất của dự án này là gì?', type: 'radio', options: ['Xây dựng tổ ấm lâu dài', 'Đầu tư kinh doanh/Cho thuê', 'Khẳng định vị thế/Nghệ thuật', 'Nâng cấp chất lượng sống'] },
      { id: 'g3', text: 'Cách làm việc bạn mong muốn với Kiến trúc sư?', type: 'radio', options: ['KTS chủ động đề xuất hoàn toàn', 'Gia đình tham gia sâu vào từng chi tiết', 'Phối hợp nhịp nhàng theo từng giai đoạn'] },
      { id: 'g4', text: 'Kỳ vọng lớn nhất của bạn ở N-H-Architects?', type: 'textarea', hint: 'Ví dụ: Sự sáng tạo đột phá, sự tỉ mỉ trong hồ sơ, hay sự thấu hiểu tâm lý.' },
      { id: 'g5', text: 'Điều gì khiến bạn lo lắng hoặc coi là rủi ro lớn nhất khi xây nhà?', type: 'textarea', hint: 'Ví dụ: Chậm tiến độ, phát sinh chi phí, hay không giống bản vẽ.' },
    ]
  },
  {
    id: 'land',
    title: '2. Hiện trạng khu đất',
    icon: <MapPin className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để phân tích bối cảnh, tận dụng ưu thế địa hình và xử lý các hạn chế về hướng nắng, gió và tiếng ồn xung quanh.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để phân tích bối cảnh và tận dụng ưu thế địa hình.',
    questions: [
      { id: 'l1', text: 'Địa chỉ/Vị trí khu đất?', type: 'text' },
      { id: 'l2', text: 'Kích thước khu đất? (Dài x Rộng)', type: 'text', hint: 'Phù hợp cho cả nhà phố và biệt thự.' },
      { id: 'l3', text: 'Hướng nhà và các công trình lân cận?', type: 'textarea', hint: 'Có bị che chắn bởi nhà cao tầng hay công trình nào không?' },
      { id: 'l4', text: 'Lộ giới và vỉa hè phía trước?', type: 'text', hint: 'Ảnh hưởng đến việc bố trí gara và khoảng lùi.' },
      { id: 'l5', text: 'Bạn có muốn giữ lại cây xanh hay kiến trúc cũ nào không?', type: 'text' },
    ]
  },
  {
    id: 'space',
    title: '3. Nhu cầu công năng',
    icon: <Layers className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để tổ chức mặt bằng, phân bổ diện tích và thiết lập sơ đồ công năng khoa học, đảm bảo sự tiện nghi và luồng giao thông tối ưu cho gia đình.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để tổ chức mặt bằng và thiết lập sơ đồ công năng khoa học.',
    questions: [
      { id: 's0', text: 'Loại hình công trình dự kiến?', type: 'radio', options: ['Nhà phố hiện đại', 'Biệt thự phố', 'Biệt thự vườn', 'Penthouse/Duplex', 'Khác'] },
      { id: 's1', text: 'Thông tin sử dụng (Số người, độ tuổi, thói quen sinh hoạt)?', type: 'textarea', hint: 'Giúp KTS phân chia không gian riêng tư và chung phù hợp.' },
      { id: 's2', text: 'Không gian sinh hoạt chính (Phòng khách, Bếp, Ăn)?', type: 'radio', options: ['Không gian mở hoàn toàn (Open Plan)', 'Phân chia khu vực rõ ràng', 'Kết hợp linh hoạt bằng vách ngăn'] },
      { id: 's3', text: 'Phòng ngủ (Số lượng và nhu cầu riêng cho từng thành viên)?', type: 'textarea', hint: 'Ví dụ: Phòng Master cần bồn tắm nằm, phòng con cần góc học tập lớn.' },
      { id: 's3_1', text: 'Khu vực Vệ sinh (Số lượng, thiết bị, thói quen)?', type: 'textarea', hint: 'Ví dụ: Cần bồn tắm nằm ở Master, vách kính tắm đứng ở phòng con, vệ sinh chung cho khách...' },
      { id: 's4', text: 'Không gian đặc biệt (Làm việc, Giải trí, Thờ cúng)?', type: 'checkbox', options: ['Phòng làm việc/Studio', 'Phòng giải trí/Karaoke', 'Phòng thờ trang nghiêm', 'Phòng Gym/Yoga'] },
      { id: 's5', text: 'Gara & Giao thông (Nhà phố/Biệt thự)?', type: 'textarea', hint: 'Số lượng xe, yêu cầu về lối đi riêng, thang máy hay thang bộ chủ đạo.' },
      { id: 's6', text: 'Không gian ngoài trời (Sân, Vườn, Hồ bơi)?', type: 'checkbox', options: ['Sân vườn cảnh quan', 'Hồ bơi/Hồ cá Koi', 'Khu BBQ ngoài trời', 'Ban công thư giãn'] },
      { id: 's7', text: 'Không gian phụ trợ (Giặt phơi, Kho, Phòng giúp việc)?', type: 'textarea', hint: 'Vị trí ưu tiên cho các khu vực kỹ thuật và hậu cần.' },
      { id: 's8', text: 'Tính linh hoạt & Phát triển tương lai?', type: 'radio', options: ['Thiết kế cố định cho hiện tại', 'Dự phòng không gian để ngăn thêm phòng', 'Có thể thay đổi công năng linh hoạt'] },
      { id: 's9', text: 'Ưu tiên & Đánh đổi trong thiết kế?', type: 'radio', options: ['Ưu tiên Diện tích phòng lớn (Ít phòng)', 'Ưu tiên Số lượng phòng (Phòng vừa đủ)', 'Ưu tiên Sự riêng tư tuyệt đối', 'Ưu tiên Sự kết nối không gian'] },
      { id: 's10', text: 'Nếu có một không gian trong nhà khiến bạn muốn dành cả ngày ở đó, đó sẽ là không gian nào và có những gì?', type: 'textarea', hint: 'Câu hỏi giúp KTS tìm ra "linh hồn" của ngôi nhà.' },
    ]
  },
  {
    id: 'style',
    title: '4. Phong cách & Thẩm mỹ đa dạng',
    icon: <Palette className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để định hướng concept thiết kế, từ đó thiết lập ngôn ngữ hình khối, lựa chọn vật liệu và màu sắc đồng nhất, tạo nên vẻ đẹp riêng cho công trình.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để định hướng concept thiết kế như thế nào',
    questions: [
      { id: 'st1', text: 'Định hướng phong cách thiết kế?', type: 'checkbox', options: ['Hiện đại (Modern)', 'Tối giản (Minimalism)', 'Tân cổ điển (Neo-Classic)', 'Đông Dương (Indochine)', 'Nhiệt đới (Tropical)', 'Địa Trung Hải (Mediterranean)', 'Wabi Sabi'] },
      { id: 'st2', text: 'Hình ảnh tham khảo (Hình ảnh hoặc mô tả)?', type: 'file', hint: 'Bạn có thể gửi hình ảnh hoặc mô tả những công trình bạn ấn tượng.' },
      { id: 'st3', text: 'Cảm xúc không gian mong muốn?', type: 'checkbox', options: ['Ấm cúng & Gần gũi', 'Sang trọng & Đẳng cấp', 'Phóng khoáng & Tự do', 'Tĩnh lặng & Thiền định', 'Năng động & Trẻ trung'] },
      { id: 'st4', text: 'Màu sắc chủ đạo & Màu nhấn?', type: 'text', hint: 'Ví dụ: Trắng - Xám làm nền, màu gỗ làm điểm nhấn ấm áp.' },
      { id: 'st5', text: 'Vật liệu & Chất cảm bề mặt?', type: 'textarea', hint: 'Bạn thích sự thô mộc của bê tông, đá tự nhiên hay sự bóng bẩy của kính và kim loại?' },
      { id: 'st6', text: 'Mức độ trang trí & Chi tiết?', type: 'radio', options: ['Tối giản tuyệt đối (Less is more)', 'Vừa đủ để tạo điểm nhấn', 'Cầu kỳ, tỉ mỉ trong từng đường nét'] },
      { id: 'st7', text: 'Mặt tiền & Ấn tượng bên ngoài?', type: 'radio', options: ['Kín đáo, hướng nội', 'Cởi mở, kết nối tối đa với bên ngoài', 'Độc bản, mang tính biểu tượng/nghệ thuật'] },
      { id: 'st8', text: 'Ánh sáng & Không khí?', type: 'radio', options: ['Tràn ngập ánh sáng tự nhiên', 'Ánh sáng tập trung, tạo kịch bản nghệ thuật', 'Dịu nhẹ, tạo sự thư giãn tuyệt đối'] },
      { id: 'st9', text: 'Mức độ an toàn vs Đột phá?', type: 'radio', options: ['An toàn, bền vững theo thời gian', 'Đột phá, sáng tạo và khác biệt', 'Cân bằng giữa công năng và nghệ thuật'] },
      { id: 'st10', text: 'Nếu ngôi nhà là một bộ phim, nó sẽ có tông màu và không khí như thế nào?', type: 'textarea', hint: 'Câu hỏi khai thác sâu giúp KTS tìm ra "linh hồn" thẩm mỹ của gia chủ.' },
    ]
  },
  {
    id: 'climate',
    title: '5. Giải pháp vi khí hậu',
    icon: <Wind className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để thiết kế các giải pháp chống nóng, thông gió và chiếu sáng tự nhiên, giúp ngôi nhà luôn mát mẻ và tiết kiệm năng lượng.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để thiết kế các giải pháp vi khí hậu tối ưu.',
    questions: [
      { id: 'c1', text: 'Cảm nhận môi trường hiện tại (Nắng, Nóng, Ồn, Bụi, Gió)?', type: 'textarea', hint: 'Khu đất có bị nắng gắt hướng Tây, ồn ào xe cộ hay bụi bặm không?' },
      { id: 'c2', text: 'Thói quen sử dụng không khí của gia đình?', type: 'radio', options: ['Thích mở cửa đón gió tự nhiên', 'Thường xuyên dùng điều hòa', 'Kết hợp linh hoạt tùy thời điểm'] },
      { id: 'c3', text: 'Ánh sáng tự nhiên: Mức độ mong muốn và khả năng chấp nhận nắng?', type: 'textarea', hint: 'Bạn thích nhà tràn ngập ánh sáng hay ưu tiên sự mát mẻ, ít nắng trực tiếp?' },
      { id: 'c4', text: 'Nhiệt độ & mức độ tiện nghi mong muốn?', type: 'radio', options: ['Mát lạnh sâu (Dùng máy)', 'Thông thoáng tự nhiên (Dùng gió)', 'Tiện nghi cân bằng'] },
      { id: 'c5', text: 'Các giải pháp tự nhiên bạn muốn tích hợp?', type: 'checkbox', options: ['Cây xanh trong nhà', 'Giếng trời lớn', 'Hồ cá/Mặt nước', 'Sân vườn cảnh quan'] },
      { id: 'c6', text: 'Vật liệu & lớp vỏ công trình (Mặt đứng, Cách nhiệt, Che nắng)?', type: 'textarea', hint: 'Tường hai lớp, kính hộp cách nhiệt, lam chắn nắng di động...' },
      { id: 'c7', text: 'Mức độ ưu tiên giữa tiếng ồn & sự riêng tư?', type: 'radio', options: ['Ưu tiên riêng tư tuyệt đối (Kín đáo)', 'Ưu tiên kết nối, mở rộng tầm nhìn'] },
      { id: 'c8', text: 'Hệ thống kỹ thuật (Điều hoà, Thông gió, Lọc khí, Năng lượng)?', type: 'checkbox', options: ['Điều hòa trung tâm', 'Hệ thống cấp khí tươi', 'Lọc bụi mịn', 'Điện năng lượng mặt trời'] },
      { id: 'c9', text: 'Ưu tiên & đánh đổi trong thiết kế?', type: 'radio', options: ['Ưu tiên Thoáng (Gió nhiều) dù có thể bụi/ồn', 'Ưu tiên Mát (Kín, dùng máy) để sạch và yên tĩnh'] },
      { id: 'c10', text: 'Một không gian thư giãn lý tưởng vào buổi chiều nắng nóng của bạn sẽ như thế nào?', type: 'textarea', hint: 'Câu hỏi giúp N-H-Architects hiểu sâu hơn về cảm nhận không gian của bạn.' },
    ]
  },
  {
    id: 'tech',
    title: '6. Công nghệ & Thiết bị cao cấp',
    icon: <Cpu className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để thiết kế hạ tầng kỹ thuật đồng bộ, tích hợp các hệ thống thông minh và phối hợp chặt chẽ với các đơn vị cung cấp thiết bị ngay từ giai đoạn sơ phác.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để thiết kế hạ tầng kỹ thuật đồng bộ và thông minh.',
    questions: [
      { id: 't1', text: 'Mức độ quan tâm của bạn về công nghệ trong nhà?', type: 'radio', options: ['Tối giản, dễ sử dụng', 'Cần các tiện ích cơ bản', 'Yêu thích trải nghiệm công nghệ cao (High-tech)'] },
      { id: 't2', text: 'Hệ thống Smart Home (Điều khiển, hệ tích hợp)?', type: 'checkbox', options: ['Điều khiển chiếu sáng', 'Rèm cửa tự động', 'Kịch bản ngữ cảnh', 'Hệ thống cảm biến', 'Tích hợp giọng nói'] },
      { id: 't3', text: 'Yêu cầu về Điều hoà & Thông gió?', type: 'radio', options: ['Điều hòa cục bộ (Treo tường)', 'Điều hòa âm trần nối ống gió', 'Hệ thống VRV/VRF trung tâm', 'Hệ thống cấp khí tươi (Fresh Air)'] },
      { id: 't4', text: 'Chiếu sáng thông minh?', type: 'checkbox', options: ['Thay đổi nhiệt độ màu (CCT)', 'Dimming (Điều chỉnh độ sáng)', 'Chiếu sáng nghệ thuật/điểm nhấn', 'Tự động theo chuyển động'] },
      { id: 't5', text: 'Âm thanh & Giải trí?', type: 'checkbox', options: ['Loa âm trần đa vùng', 'Phòng xem phim chuyên dụng (Home Cinema)', 'Hệ thống Karaoke', 'Âm thanh sân vườn'] },
      { id: 't6', text: 'An ninh & Kiểm soát ra vào?', type: 'checkbox', options: ['Camera AI', 'Khóa cửa thông minh (Vân tay/Khuôn mặt)', 'Hệ thống báo động/chống đột nhập', 'Chuông cửa có hình'] },
      { id: 't7', text: 'Năng lượng & Bền vững?', type: 'checkbox', options: ['Điện năng lượng mặt trời', 'Trạm sạc xe điện', 'Hệ thống quản lý năng lượng thông minh'] },
      { id: 't8', text: 'Các thiết bị cao cấp khác?', type: 'textarea', hint: 'Lọc nước trung tâm, nước nóng Heatpump, thiết bị bếp âm tủ (Miele, Bosch...), thiết bị vệ sinh thông minh...' },
    ]
  },
  {
    id: 'fengshui',
    title: '7. Phong thuỷ hiện đại',
    icon: <Compass className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để cân bằng giữa yếu tố tâm linh và công năng kiến trúc, đảm bảo ngôi nhà mang lại sự an tâm và vượng khí cho gia chủ.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để cân bằng giữa yếu tố tâm linh và công năng kiến trúc.',
    questions: [
      { id: 'f1', text: 'Mức độ quan tâm của bạn về phong thủy?', type: 'radio', options: ['Rất chú trọng', 'Cân bằng giữa phong thủy và công năng', 'Khoa học kiến trúc là chính'] },
      { id: 'f2', text: 'Thông tin gia chủ (Năm sinh, vai trò trong gia đình)?', type: 'textarea', hint: 'Giúp xác định cung mệnh và các hướng tốt/xấu.' },
      { id: 'f3', text: 'Yêu cầu cụ thể về hướng (Hướng nhà, hướng bếp, hướng bàn thờ)?', type: 'textarea' },
      { id: 'f4', text: 'Mong muốn bố trí không gian theo phong thủy?', type: 'textarea', hint: 'Ví dụ: Vị trí đặt cầu thang, phòng ngủ Master, khu vệ sinh...' },
      { id: 'f5', text: 'Kích thước & con số (Thước Lỗ Ban, các số cần kiêng kỵ)?', type: 'text', hint: 'Bạn có yêu cầu khắt khe về kích thước thông thủy cửa, số bậc cầu thang không?' },
      { id: 'f6', text: 'Vật phẩm phong thủy & yếu tố tâm linh?', type: 'textarea', hint: 'Bạn dự kiến đặt tỳ hưu, thác nước, tranh phong thủy... ở đâu?' },
      { id: 'f7', text: 'Nghi lễ & thờ cúng?', type: 'textarea', hint: 'Yêu cầu về không gian phòng thờ, hướng nhìn và sự trang nghiêm.' },
      { id: 'f8', text: 'Những điều kiêng kỵ đặc biệt của gia đình?', type: 'textarea', hint: 'Những điều bạn tuyệt đối không muốn xuất hiện trong thiết kế.' },
      { id: 'f9', text: 'Cách làm việc với thầy phong thủy (nếu có)?', type: 'radio', options: ['KTS tự tư vấn', 'Gia đình đã có thầy riêng', 'Cần KTS phối hợp trực tiếp với thầy'] },
    ]
  },
  {
    id: 'finance',
    title: '8. Ngân sách & Tiến độ',
    icon: <DollarSign className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để tư vấn giải pháp vật liệu, biện pháp thi công và quản trị rủi ro tài chính, đảm bảo công trình hoàn thiện đúng kế hoạch và trong tầm kiểm soát của bạn.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để tư vấn giải pháp vật liệu và quản trị rủi ro tài chính.',
    questions: [
      { id: 'fi1', text: 'Tổng mức đầu tư dự kiến cho toàn bộ công trình?', type: 'text', hint: 'Bao gồm xây dựng thô, hoàn thiện và nội thất.' },
      { id: 'fi2', text: 'Phân bổ ngân sách ưu tiên?', type: 'radio', options: ['Ưu tiên phần thô & kết cấu bền vững', 'Ưu tiên vật liệu hoàn thiện cao cấp', 'Ưu tiên nội thất & thiết bị thông minh'] },
      { id: 'fi3', text: 'Dòng tiền & hình thức thanh toán dự kiến?', type: 'radio', options: ['Vốn tự có sẵn sàng', 'Kết hợp vay ngân hàng', 'Thanh toán theo tiến độ thi công'] },
      { id: 'fi4', text: 'Mức độ chấp nhận phát sinh ngân sách?', type: 'radio', options: ['Tuyệt đối không phát sinh', 'Chấp nhận phát sinh 5-10% cho chất lượng tốt hơn', 'Linh hoạt theo thực tế tư vấn'] },
      { id: 'fi5', text: 'Thời điểm bắt đầu và tiến độ mong muốn hoàn thiện?', type: 'text', hint: 'Ví dụ: Khởi công tháng 6, hoàn thiện trước Tết.' },
      { id: 'fi6', text: 'Khả năng linh hoạt về tiến độ?', type: 'radio', options: ['Cần hoàn thiện gấp đúng hạn', 'Có thể gia hạn để đảm bảo chất lượng tỉ mỉ', 'Linh hoạt theo điều kiện thi công'] },
      { id: 'fi7', text: 'Chiến lược triển khai công trình?', type: 'radio', options: ['Làm một lần hoàn thiện toàn bộ', 'Chia giai đoạn (Xây thô trước, nội thất sau)', 'Hoàn thiện dần theo nhu cầu sử dụng'] },
      { id: 'fi8', text: 'Mức độ kiểm soát chi phí bạn mong muốn?', type: 'radio', options: ['KTS tự cân đối trong ngân sách tổng', 'Cần báo giá chi tiết từng hạng mục nhỏ', 'Giám sát chặt chẽ mọi thay đổi chi phí'] },
      { id: 'fi9', text: 'Rủi ro hoặc kinh nghiệm xây dựng trước đó của bạn?', type: 'textarea', hint: 'Những lo lắng về tài chính hoặc tiến độ bạn từng gặp phải.' },
      { id: 'fi10', text: 'Giữa "Chất lượng hoàn mỹ" và "Tiết kiệm chi phí", bạn ưu tiên bên nào hơn?', type: 'radio', options: ['Chất lượng là trên hết', 'Cân bằng tối ưu', 'Tiết kiệm tối đa'] },
    ]
  },
  {
    id: 'insight',
    title: '9. Khai thác sâu (Insight)',
    icon: <Lightbulb className="w-5 h-5" />,
    description: 'Kiến trúc sư sử dụng thông tin này để chạm đến những mong muốn thầm kín và cảm xúc của gia chủ, biến ngôi nhà thành một tác phẩm nghệ thuật kể chuyện.',
    footerNote: 'Kiến trúc sư sử dụng thông tin này để chạm đến những mong muốn thầm kín và cảm xúc của gia chủ.',
    questions: [
      { id: 'i1', text: 'Hãy mô tả một "khoảnh khắc hạnh phúc" bạn hình dung trong ngôi nhà mới?', type: 'textarea' },
      { id: 'i2', text: 'Điều gì ở ngôi nhà hiện tại khiến bạn cảm thấy bất tiện nhất?', type: 'textarea' },
      { id: 'i3', text: 'Nếu ngôi nhà là một tác phẩm nghệ thuật, nó sẽ kể câu chuyện gì về bạn?', type: 'textarea' },
      { id: 'i4', text: 'Bạn muốn khách đến nhà sẽ thốt lên điều gì đầu tiên?', type: 'text' },
    ]
  }
];

export default function App() {
  return (
    <SurveyApp />
  );
}

function SurveyApp() {
  const [activeSection, setActiveSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (id: string, value: any) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const getExcelBlob = async (): Promise<{ blob: Blob, fileName: string }> => {
    const fileName = `Khao_sat_NH_Architects_${answers['g0_1'] || 'Khach_hang'}.xlsx`;
    try {
      console.log('Attempting ExcelJS generation...');
      let workbook: any;
      if ((ExcelJS as any).Workbook) {
        workbook = new (ExcelJS as any).Workbook();
      } else if ((ExcelJS as any).default && (ExcelJS as any).default.Workbook) {
        workbook = new (ExcelJS as any).default.Workbook();
      } else {
        throw new Error('ExcelJS Workbook constructor not found');
      }
      const worksheet = workbook.addWorksheet('Khao sat N-H Architects');

      // Add Company Info Header
      worksheet.mergeCells('A1:B1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'N-H-ARCHITECTS';
      titleCell.font = { name: 'Arial', size: 22, bold: true, color: { argb: 'FF000000' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:B2');
      const subTitleCell = worksheet.getCell('A2');
      subTitleCell.value = 'THIẾT KẾ KIẾN TRÚC, NỘI THẤT VÀ CẢNH QUAN';
      subTitleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF666666' } };
      subTitleCell.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:B3');
      const contactCell = worksheet.getCell('A3');
      contactCell.value = 'Địa chỉ: 20 Phan Đình Phùng, Rạch Giá, An Giang | Hotline: 0394053939';
      contactCell.font = { name: 'Arial', size: 10 };
      contactCell.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A4:B4');
      const webCell = worksheet.getCell('A4');
      webCell.value = 'Email: architects.nh@gmail.com | Website: www.nh-architects.vn';
      webCell.font = { name: 'Arial', size: 10, color: { argb: 'FF0000FF' }, underline: true };
      webCell.alignment = { horizontal: 'center' };

      worksheet.addRow([]); // Spacer
      worksheet.addRow([]); // Spacer

      // Add Customer Info
      const customerHeader = worksheet.addRow(['THÔNG TIN KHÁCH HÀNG', '']);
      customerHeader.font = { bold: true, size: 14 };
      customerHeader.getCell(1).border = { bottom: { style: 'thick' } };
      
      worksheet.addRow(['Họ và tên:', answers['g0_1'] || 'Chưa cung cấp']).font = { bold: true };
      worksheet.addRow(['Năm sinh:', answers['g0_2'] || 'Chưa cung cấp']);
      worksheet.addRow(['Ngày thực hiện:', new Date().toLocaleDateString('vi-VN')]);
      worksheet.addRow([]); // Spacer

      // Add Survey Data
      briefSections.forEach(section => {
        const sectionRow = worksheet.addRow([section.title.toUpperCase(), '']);
        sectionRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sectionRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF000000' }
        };

        section.questions.forEach(q => {
          let answer = answers[q.id];
          if (Array.isArray(answer)) {
            if (q.type === 'file') {
              answer = answer.map((f: any) => f.name).join(', ');
              const desc = answers[`${q.id}_desc`];
              if (desc) answer += ` (Mô tả: ${desc})`;
            } else {
              answer = answer.join(', ');
            }
          }
          
          const row = worksheet.addRow([q.text, answer || '(Trống)']);
          row.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
          row.getCell(2).alignment = { wrapText: true, vertical: 'middle' };
        });
        
        worksheet.addRow([]); // Spacer
      });

      // Styling columns
      worksheet.getColumn(1).width = 50;
      worksheet.getColumn(2).width = 80;

      const buffer = await workbook.xlsx.writeBuffer();
      return { blob: new Blob([buffer]), fileName };
    } catch (exceljsError) {
      console.warn('ExcelJS failed, falling back to XLSX:', exceljsError);
      // Fallback to XLSX (SheetJS)
      const data = [
        ['N-H-ARCHITECTS'],
        ['THIẾT KẾ KIẾN TRÚC, NỘI THẤT VÀ CẢNH QUAN'],
        ['THÔNG TIN KHÁCH HÀNG'],
        ['Họ và tên:', answers['g0_1'] || 'Chưa cung cấp'],
        ['Năm sinh:', answers['g0_2'] || 'Chưa cung cấp'],
        ['Ngày thực hiện:', new Date().toLocaleDateString('vi-VN')],
        []
      ];

      briefSections.forEach(section => {
        data.push([section.title.toUpperCase()]);
        section.questions.forEach(q => {
          let answer = answers[q.id];
          if (Array.isArray(answer)) {
            if (q.type === 'file') {
              answer = answer.map((f: any) => f.name).join(', ');
            } else {
              answer = answer.join(', ');
            }
          }
          data.push([q.text, answer || '(Trống)']);
        });
        data.push([]);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Khao sat');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return { blob: new Blob([wbout]), fileName };
    }
  };

  const exportToExcel = async () => {
    console.log('Starting Excel export...');
    setIsExporting(true);
    try {
      const { blob, fileName } = await getExcelBlob();
      saveAs(blob, fileName);
      console.log('Excel export successful');
    } catch (error) {
      console.error('Excel Export Error:', error);
      alert('Có lỗi xảy ra khi xuất file Excel. Chi tiết: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  const handleGoogleDriveUpload = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID') {
      alert('Vui lòng cấu hình Google Client ID trong phần Secrets (VITE_GOOGLE_CLIENT_ID).');
      return;
    }
    if (!googleAccessToken) {
      // Initialize Google OAuth2
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.access_token) {
            setGoogleAccessToken(response.access_token);
            uploadToDrive(response.access_token);
          }
        },
      });
      client.requestAccessToken();
    } else {
      uploadToDrive(googleAccessToken);
    }
  };

  const uploadToDrive = async (token: string) => {
    console.log('Starting Google Drive upload (Excel)...');
    setIsUploadingToDrive(true);
    try {
      // 1. Generate Excel Blob
      const { blob: excelBlob, fileName } = await getExcelBlob();
      console.log('Excel generated successfully for Drive upload, size:', excelBlob.size);

      // 2. Upload to Google Drive
      const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      const metadata: any = {
        name: fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      if (folderId && folderId !== 'YOUR_GOOGLE_DRIVE_FOLDER_ID') {
        metadata.parents = [folderId];
      }

      console.log('Uploading Excel to Drive with metadata:', metadata);

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', excelBlob);

      const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=${import.meta.env.VITE_GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Drive upload successful:', result);
        alert('Đã tải file Excel lên Google Drive thành công!');
      } else {
        const errorData = await response.json();
        console.error('Drive Upload Error Response:', errorData);
        if (response.status === 401) {
          setGoogleAccessToken(null);
          alert('Phiên làm việc Google đã hết hạn. Vui lòng thử lại.');
        } else {
          alert(`Có lỗi xảy ra khi tải lên Google Drive: ${errorData.error?.message || response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Drive Upload Error:', error);
      alert('Có lỗi xảy ra khi kết nối với Google Drive. Chi tiết: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const exportToPDF = async () => {
    setIsExportingPDF(true);
    try {
      const element = document.getElementById('pdf-content');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Khao_sat_NH_Architects_${answers['g0_1'] || 'Khach_hang'}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Có lỗi xảy ra khi xuất file PDF.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const nextSection = async () => {
    if (activeSection < briefSections.length - 1) {
      setActiveSection(activeSection + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setIsSaving(true);
      try {
        await addDoc(collection(db, 'surveys'), {
          clientName: answers['g0_1'] || 'Khách hàng',
          answers: answers,
          completedAt: new Date().toISOString()
        });
        setIsFinished(true);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'surveys');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const prevSection = () => {
    if (activeSection > 0) {
      setActiveSection(activeSection - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentSection = briefSections[activeSection];
  const progress = ((activeSection + 1) / briefSections.length) * 100;

  const pdfContent = (
    <div id="pdf-content" className="fixed left-[-9999px] top-0 w-[800px] p-12 font-sans" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
      <div className="flex items-center gap-4 mb-12 border-b-2 pb-8" style={{ borderBottomColor: '#000000' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
          <Logo className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter" style={{ color: '#000000' }}>N-H-ARCHITECTS</h1>
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: '#9ca3af' }}>Townhouses & Villas Design</p>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-2 uppercase" style={{ color: '#000000' }}>BẢN TỔNG HỢP KHẢO SÁT</h2>
        <p className="font-medium" style={{ color: '#6b7280' }}>Ngày thực hiện: {new Date().toLocaleDateString('vi-VN')}</p>
      </div>

      <div className="space-y-10">
        {briefSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-4">
            <h3 className="text-xl font-bold border-l-4 pl-4 uppercase py-2" style={{ borderLeftColor: '#000000', backgroundColor: '#f9fafb', color: '#000000' }}>{section.title}</h3>
            <div className="grid grid-cols-1 gap-4">
              {section.questions.map((q) => {
                let answer = answers[q.id];
                if (!answer) return null;
                
                if (Array.isArray(answer)) {
                  if (q.type === 'file') {
                    answer = `${answer.length} hình ảnh đã tải lên`;
                    const desc = answers[`${q.id}_desc`];
                    if (desc) answer += ` (${desc})`;
                  } else {
                    answer = answer.join(', ');
                  }
                }

                return (
                  <div key={q.id} className="border-b pb-4" style={{ borderBottomColor: '#f3f4f6' }}>
                    <p className="text-xs font-bold uppercase mb-1" style={{ color: '#9ca3af' }}>{q.text}</p>
                    <p className="text-sm font-medium leading-relaxed" style={{ color: '#000000' }}>{answer}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 pt-8 border-t text-center" style={{ borderTopColor: '#e5e7eb' }}>
        <p className="text-xs font-bold italic" style={{ color: '#9ca3af' }}>Cảm ơn quý khách đã tin tưởng N-H-Architects!</p>
        <p className="text-[10px] font-bold tracking-[0.2em] mt-2" style={{ color: '#000000' }}>WWW.NH-ARCHITECTS.VN</p>
      </div>
    </div>
  );

  if (isFinished) {
    return (
      <>
        <div className="min-h-screen bg-[#F8F8F8] flex items-center justify-center p-6 font-sans">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full bg-white rounded-[40px] p-12 shadow-2xl text-center border border-black/5 print-hidden"
          >
            <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-black mb-4 tracking-tight uppercase">HOÀN TẤT KHẢO SÁT</h1>
            <p className="text-lg text-gray-500 mb-10 leading-relaxed">
              Cảm ơn bạn đã dành thời gian chia sẻ. Đội ngũ kiến trúc sư của <span className="text-black font-bold">N-H-Architects</span> sẽ nghiên cứu kỹ lưỡng các thông tin này để kiến tạo nên một không gian sống đẳng cấp và mang đậm dấu ấn cá nhân của bạn.
            </p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={exportToExcel}
                disabled={isExporting}
                className={`px-8 py-4 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all font-bold shadow-lg flex items-center justify-center gap-2 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isExporting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5" />
                )}
                {isExporting ? 'Đang xuất Excel...' : 'Xuất file Excel'}
              </button>
              <button 
                onClick={exportToPDF}
                disabled={isExportingPDF}
                className={`px-8 py-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all font-bold shadow-lg flex items-center justify-center gap-2 ${isExportingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isExportingPDF ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                {isExportingPDF ? 'Đang xuất PDF...' : 'Xuất file PDF'}
              </button>
              <button 
                onClick={handleGoogleDriveUpload}
                disabled={isUploadingToDrive}
                className={`px-8 py-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all font-bold shadow-lg flex items-center justify-center gap-2 ${isUploadingToDrive ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploadingToDrive ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                {isUploadingToDrive ? 'Đang tải lên Drive...' : 'Lưu Excel vào Google Drive'}
              </button>
              <button 
                onClick={() => {
                  setIsFinished(false);
                  setActiveSection(0);
                  setAnswers({});
                }}
                className="text-sm text-gray-400 hover:text-black transition-colors underline underline-offset-4"
              >
                Làm lại khảo sát mới
              </button>
            </div>
          </motion.div>
        </div>
        {pdfContent}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-black font-sans selection:bg-black selection:text-white">
      <div className="print-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-5">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center shadow-md text-white">
              <Logo className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase">N-H-ARCHITECTS</h1>
              <p className="text-[9px] uppercase tracking-[0.4em] opacity-40 font-bold">Townhouse & Villa Specialists</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mb-1">Tiến độ khảo sát</p>
              <p className="text-sm font-black">{Math.round(progress)}%</p>
            </div>
            <div className="w-40 h-1.5 bg-black/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-black" 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-16">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block">
          <div className="sticky top-32 space-y-8">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-30 font-black mb-6">Danh mục khảo sát</p>
              <div className="space-y-1">
                {briefSections.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(index)}
                    className={`w-full text-left px-5 py-4 rounded-2xl transition-all flex items-center gap-4 group ${
                      activeSection === index 
                        ? 'bg-white shadow-xl shadow-black/5 text-black font-bold scale-[1.02]' 
                        : 'hover:bg-white/50 opacity-40 hover:opacity-100'
                    }`}
                  >
                    <span className={`p-2 rounded-xl transition-all ${activeSection === index ? 'bg-black text-white' : 'bg-black/5 group-hover:bg-black/10'}`}>
                      {React.cloneElement(section.icon as React.ReactElement, { size: 16 })}
                    </span>
                    <span className="text-sm tracking-tight">{section.title.split('. ')[1]}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6 bg-black rounded-[32px] text-white shadow-xl shadow-black/10">
              <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold mb-2">Hỗ trợ trực tiếp</p>
              <p className="text-sm font-bold mb-4">ThS.KTS Nguyễn Xuân Huy</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <User size={18} />
                </div>
                <div className="text-xs">
                  <p className="font-bold">Hotline: 0394053939</p>
                  <p className="opacity-50">architects.nh@gmail.com</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-[48px] p-10 md:p-16 shadow-2xl shadow-black/[0.02] border border-black/5"
            >
              <div className="flex items-start justify-between mb-12">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.5em] text-gray-400 font-black">Phần {activeSection + 1} / {briefSections.length}</p>
                  <h2 className="text-4xl font-black tracking-tight leading-tight">{currentSection.title}</h2>
                  {currentSection.description && (
                    <p className="text-sm text-gray-500 font-medium italic mt-2">{currentSection.description}</p>
                  )}
                </div>
                <div className="w-16 h-16 bg-black/5 rounded-3xl flex items-center justify-center text-black">
                  {React.cloneElement(currentSection.icon as React.ReactElement, { size: 32 })}
                </div>
              </div>

              <div className="space-y-12">
                {currentSection.questions.map((q) => (
                  <div key={q.id} className="space-y-4">
                    <label className="block text-xl font-bold tracking-tight text-gray-900">
                      {q.text}
                    </label>
                    
                    {q.hint && (
                      <div className="flex items-start gap-2 text-sm text-gray-400 italic">
                        <Info size={14} className="mt-0.5 shrink-0" />
                        <span>{q.hint}</span>
                      </div>
                    )}

                    {q.type === 'text' && (
                      <input
                        type="text"
                        value={answers[q.id] || ''}
                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                        className="w-full bg-gray-50 border-2 border-transparent focus:border-black focus:bg-white rounded-2xl px-6 py-5 transition-all outline-none font-medium text-lg"
                        placeholder="Nhập câu trả lời..."
                      />
                    )}

                    {q.type === 'textarea' && (
                      <textarea
                        rows={4}
                        value={answers[q.id] || ''}
                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                        className="w-full bg-gray-50 border-2 border-transparent focus:border-black focus:bg-white rounded-3xl px-6 py-5 transition-all outline-none font-medium text-lg resize-none"
                        placeholder="Mô tả chi tiết mong muốn của bạn..."
                      />
                    )}

                    {q.type === 'radio' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options?.map(opt => (
                          <button
                            key={opt}
                            onClick={() => handleInputChange(q.id, opt)}
                            className={`px-6 py-4 rounded-2xl border-2 transition-all text-left font-bold text-sm ${
                              answers[q.id] === opt 
                                ? 'bg-black border-black text-white shadow-xl shadow-black/20' 
                                : 'bg-white border-gray-100 hover:border-black/20'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'checkbox' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options?.map(opt => {
                          const current = answers[q.id] || [];
                          const isSelected = current.includes(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => {
                                const next = isSelected 
                                  ? current.filter((i: string) => i !== opt)
                                  : [...current, opt];
                                handleInputChange(q.id, next);
                              }}
                              className={`px-6 py-4 rounded-2xl border-2 transition-all text-left font-bold text-sm ${
                                isSelected 
                                  ? 'bg-black border-black text-white shadow-xl shadow-black/20' 
                                  : 'bg-white border-gray-100 hover:border-black/20'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'file' && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-4">
                          {(answers[q.id] || []).map((file: any, index: number) => (
                            <div key={index} className="relative group w-24 h-24 rounded-2xl overflow-hidden border border-black/5 bg-gray-50">
                              <img src={file.preview} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <button 
                                onClick={() => {
                                  const next = [...answers[q.id]].filter((_, i) => i !== index);
                                  handleInputChange(q.id, next);
                                }}
                                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 hover:border-black/20 flex flex-col items-center justify-center cursor-pointer transition-all bg-gray-50/50 group">
                            <Upload size={20} className="text-gray-400 group-hover:text-black transition-colors" />
                            <span className="text-[10px] font-bold text-gray-400 group-hover:text-black mt-1">Thêm ảnh</span>
                            <input 
                              type="file" 
                              multiple 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []) as File[];
                                const newFiles = files.map((f: File) => ({
                                  name: f.name,
                                  preview: URL.createObjectURL(f)
                                }));
                                handleInputChange(q.id, [...(answers[q.id] || []), ...newFiles]);
                              }}
                            />
                          </label>
                        </div>
                        <textarea
                          rows={2}
                          value={answers[`${q.id}_desc`] || ''}
                          onChange={(e) => handleInputChange(`${q.id}_desc`, e.target.value)}
                          className="w-full bg-gray-50 border-2 border-transparent focus:border-black focus:bg-white rounded-2xl px-6 py-4 transition-all outline-none font-medium text-sm resize-none"
                          placeholder="Mô tả thêm về các hình ảnh này (nếu có)..."
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {currentSection.footerNote && (
                <div className="mt-12 pt-8 border-t border-black/5">
                  <p className="text-sm text-gray-400 font-medium italic text-center">
                    {currentSection.footerNote}
                  </p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-20 pt-12 border-t border-black/5 flex justify-between items-center">
                <button
                  onClick={prevSection}
                  disabled={activeSection === 0}
                  className={`flex items-center gap-2 px-8 py-4 rounded-2xl transition-all font-bold text-sm ${
                    activeSection === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-black/5'
                  }`}
                >
                  <ChevronLeft size={20} />
                  Quay lại
                </button>

                <button
                  onClick={nextSection}
                  disabled={isSaving}
                  className="flex items-center gap-3 px-12 py-5 bg-black text-white rounded-2xl hover:bg-gray-800 transition-all shadow-2xl shadow-black/20 font-bold group disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    activeSection === briefSections.length - 1 ? 'Hoàn tất khảo sát' : 'Tiếp theo'
                  )}
                  {!isSaving && <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Mobile Progress Bar */}
          <div className="lg:hidden mt-10 flex justify-center gap-1.5">
            {briefSections.map((_, index) => (
              <div 
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeSection ? 'w-10 bg-black' : 'w-2 bg-black/10'
                }`}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-20 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 text-[10px] font-bold tracking-[0.3em] uppercase">
        <p>© 2026 N-H-ARCHITECTS — TOWNHOUSES & VILLAS</p>
        <div className="flex gap-8">
          <a href="#" className="hover:text-black transition-colors">Facebook</a>
          <a href="#" className="hover:text-black transition-colors">Instagram</a>
          <a href="#" className="hover:text-black transition-colors">Website</a>
        </div>
      </footer>

      {/* Hidden content for PDF generation */}
      {pdfContent}
      </div>
    </div>
  );
}
