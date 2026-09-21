export interface ServerLineConfig {
  enabled: boolean;
  channelAccessToken: string;
  destinationId: string;
  notifyStockOut: boolean;
  notifyStockIn: boolean;
  notifyLogin: boolean;
  notifyLogout: boolean;
  notifyLowStock?: boolean;
}

// In-memory config initialized from environment variables or Firestore updates
let serverLineConfig: ServerLineConfig = {
  enabled: true,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  destinationId: process.env.LINE_DESTINATION_ID || '',
  notifyStockOut: true,
  notifyStockIn: true,
  notifyLogin: true,
  notifyLogout: true,
  notifyLowStock: true,
};

export const updateServerLineConfig = (newConfig: Partial<ServerLineConfig>) => {
  serverLineConfig = {
    ...serverLineConfig,
    ...newConfig,
  };
  return serverLineConfig;
};

export const getServerLineConfig = (): ServerLineConfig => {
  return serverLineConfig;
};

/**
 * Send push message via LINE Messaging API
 */
export const pushLineMessage = async (
  messages: any[],
  customToken?: string,
  customDestination?: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> => {
  const rawToken = (customToken || serverLineConfig.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const rawDestination = (customDestination || serverLineConfig.destinationId || process.env.LINE_DESTINATION_ID || '').trim();

  // Clean token from quotes, spaces, or accidentally pasted "Bearer " prefixes
  const token = rawToken.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
  const destination = rawDestination.replace(/^["']|["']$/g, '').trim();

  if (!token) {
    return { success: false, skipped: true, error: 'LINE Channel Access Token ยังไม่ได้กำหนดค่า' };
  }
  if (!destination) {
    return { success: false, skipped: true, error: 'LINE Destination ID (User ID / Group ID) ยังไม่ได้กำหนดค่า' };
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: destination,
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errMsg = `LINE API HTTP ${response.status}`;
      try {
        const json = JSON.parse(errorBody);
        if (json.message) errMsg = json.message;
        if (json.details && json.details.length > 0) {
          errMsg += ` (${json.details.map((d: any) => d.message).join(', ')})`;
        }
      } catch (_) {}

      // Handle common LINE API error scenarios with clear guidance
      if (response.status === 401) {
        errMsg = 'รหัส Token ไม่ถูกต้องหรือหมดอายุ (401 Authentication failed): กรุณาตรวจสอบว่าคัดลอก "Channel access token (long-lived)" จากแท็บ Messaging API ใน LINE Developers Console (ห้ามใช้ Channel Secret ใน Basic settings)';
      } else if (response.status === 400) {
        errMsg = `ข้อมูลปลายทางไม่ถูกต้อง (400 Bad Request): ตรวจสอบ Destination ID "${destination}" (ต้องเป็น User ID ขึ้นต้นด้วย U... หรือ Group ID ขึ้นต้นด้วย C.../R... และบอทต้องอยู่ในกลุ่มนั้น)`;
      }

      console.warn('LINE Messaging API notice:', response.status, errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Failed to call LINE API:', err?.message || err);
    return { success: false, error: err?.message || 'Network connection to LINE API failed' };
  }
};

/**
 * Build Flex Message for Stock Transaction (Stock In / Stock Out)
 */
export const createStockFlexMessage = (data: {
  type: 'in' | 'out';
  itemId: string;
  itemName: string;
  category?: string;
  qty: number;
  unit: string;
  location?: string;
  requestedBy: string;
  purpose?: string;
  timestamp?: string;
  previousQty?: number;
  newQty?: number;
  status?: 'normal' | 'low' | 'out';
}) => {
  const isStockIn = data.type === 'in';
  const headerBgColor = isStockIn ? '#059669' : '#DC2626'; // Emerald for In, Red for Out
  const headerTitle = isStockIn ? '📥 แจ้งเตือนรับเข้าสินค้า (Stock In)' : '📤 แจ้งเตือนการเบิกสินค้า (Stock Out)';
  const qtyPrefix = isStockIn ? '+' : '-';
  const qtyBadgeColor = isStockIn ? '#059669' : '#DC2626';

  const timeStr = data.timestamp || new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const remainingQty = data.newQty !== undefined ? data.newQty : null;

  return {
    type: 'flex',
    altText: `${headerTitle}: ${data.itemName} (${qtyPrefix}${data.qty} ${data.unit})`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBgColor,
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: headerTitle,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ENG SMART STORE • Store FL.6',
            color: '#FFFFFFCC',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          // Item Name
          {
            type: 'text',
            text: data.itemName,
            weight: 'bold',
            size: 'lg',
            color: '#1E293B',
            wrap: true,
          },
          // Item Code & Category
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: `รหัส: ${data.itemId}`,
                size: 'xs',
                color: '#64748B',
                flex: 0,
              },
              {
                type: 'text',
                text: data.category ? ` • หมวด: ${data.category}` : '',
                size: 'xs',
                color: '#64748B',
                flex: 1,
              },
            ],
          },
          {
            type: 'separator',
            margin: 'lg',
            color: '#E2E8F0',
          },
          // Transaction Details Table
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              // Quantity
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: isStockIn ? 'จำนวนที่รับเข้า' : 'จำนวนที่เบิก',
                    size: 'sm',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: `${qtyPrefix}${data.qty} ${data.unit}`,
                    size: 'md',
                    weight: 'bold',
                    color: qtyBadgeColor,
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              // Remaining Stock (if known)
              ...(remainingQty !== null
                ? [
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: 'คงเหลือในคลัง',
                          size: 'sm',
                          color: '#64748B',
                          flex: 4,
                        },
                        {
                          type: 'text',
                          text: `${remainingQty} ${data.unit} ${remainingQty <= 0 ? '(หมดสต็อก!)' : ''}`,
                          size: 'sm',
                          weight: 'bold',
                          color: remainingQty <= 0 ? '#DC2626' : '#1E293B',
                          align: 'end',
                          flex: 6,
                        },
                      ],
                    },
                  ]
                : []),
              // Location
              ...(data.location
                ? [
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: 'ตำแหน่งจัดเก็บ',
                          size: 'sm',
                          color: '#64748B',
                          flex: 4,
                        },
                        {
                          type: 'text',
                          text: data.location,
                          size: 'sm',
                          color: '#1E293B',
                          align: 'end',
                          flex: 6,
                        },
                      ],
                    },
                  ]
                : []),
              // Requested / Performed By
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: isStockIn ? 'ผู้รับเข้า' : 'ผู้เบิก',
                    size: 'sm',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: data.requestedBy || 'ไม่ระบุ',
                    size: 'sm',
                    weight: 'bold',
                    color: '#1E293B',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              // Purpose / Job
              ...(data.purpose
                ? [
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: isStockIn ? 'แหล่งที่มา' : 'งาน/วัตถุประสงค์',
                          size: 'sm',
                          color: '#64748B',
                          flex: 4,
                        },
                        {
                          type: 'text',
                          text: data.purpose,
                          size: 'sm',
                          color: '#1E293B',
                          align: 'end',
                          wrap: true,
                          flex: 6,
                        },
                      ],
                    },
                  ]
                : []),
              // Time
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'เวลาทำรายการ',
                    size: 'xs',
                    color: '#94A3B8',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: timeStr,
                    size: 'xs',
                    color: '#94A3B8',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
};

/**
 * Build Flex Message for User Authentication (Login / Logout)
 */
export const createAuthFlexMessage = (data: {
  type: 'login' | 'logout';
  userId: string;
  username: string;
  name: string;
  nickname?: string;
  role: 'admin' | 'user';
  timestamp?: string;
}) => {
  const isLogin = data.type === 'login';
  const headerBgColor = isLogin ? '#2563EB' : '#475569'; // Blue for Login, Slate for Logout
  const headerTitle = isLogin ? '🟢 แจ้งเตือนเข้าสู่ระบบ (User Login)' : '🔴 แจ้งเตือนออกจากระบบ (User Logout)';
  const roleLabel = data.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้ทั่วไป (Staff)';

  const timeStr = data.timestamp || new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const displayName = data.nickname ? `${data.name} (${data.nickname})` : data.name;

  return {
    type: 'flex',
    altText: `${headerTitle}: ${displayName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBgColor,
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: headerTitle,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ENG SMART STORE • Security & Session',
            color: '#FFFFFFCC',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          // User Name
          {
            type: 'text',
            text: displayName,
            weight: 'bold',
            size: 'lg',
            color: '#1E293B',
            wrap: true,
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#E2E8F0',
          },
          // Details
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'รหัสพนักงาน (ID)',
                    size: 'sm',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: data.userId || data.username,
                    size: 'sm',
                    weight: 'bold',
                    color: '#1E293B',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'สิทธิ์การใช้งาน',
                    size: 'sm',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: roleLabel,
                    size: 'sm',
                    weight: 'bold',
                    color: data.role === 'admin' ? '#4F46E5' : '#059669',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'เวลาทำรายการ',
                    size: 'xs',
                    color: '#94A3B8',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: timeStr,
                    size: 'xs',
                    color: '#94A3B8',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
};

/**
 * Build Flex Message for Bulk Stock Out
 */
export const createBulkStockFlexMessage = (data: {
  items: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    unit: string;
    newQty?: number;
  }>;
  requestedBy: string;
  purpose: string;
  timestamp?: string;
}) => {
  const headerBgColor = '#2563EB'; // Blue
  const headerTitle = `📤 แจ้งเตือนการเบิกหลายรายการ (${data.items.length} รายการ)`;
  const totalUnits = data.items.reduce((sum, i) => sum + i.qty, 0);

  const timeStr = data.timestamp || new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemBoxes: any[] = data.items.slice(0, 10).map((item) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `• ${item.itemName}`,
        size: 'xs',
        color: '#1E293B',
        flex: 3,
        wrap: true,
      },
      {
        type: 'text',
        text: `-${item.qty} ${item.unit}`,
        size: 'xs',
        weight: 'bold',
        color: '#DC2626',
        align: 'end',
        flex: 1,
      }
    ]
  }));

  return {
    type: 'flex',
    altText: `${headerTitle}: รวม ${totalUnits} ชิ้น โดย ${data.requestedBy}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBgColor,
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: headerTitle,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ENG SMART STORE • Store FL.6',
            color: '#FFFFFFCC',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'รายการสินค้าที่เบิก:',
                weight: 'bold',
                size: 'sm',
                color: '#334155',
              },
              {
                type: 'text',
                text: `รวม ${totalUnits} ชิ้น`,
                weight: 'bold',
                size: 'xs',
                color: '#2563EB',
                align: 'end',
              }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'sm',
            spacing: 'xs',
            contents: itemBoxes
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#E2E8F0',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '👤 ผู้เบิก:', size: 'xs', color: '#64748B', flex: 2 },
                  { type: 'text', text: data.requestedBy, size: 'xs', weight: 'bold', color: '#1E293B', flex: 4, align: 'end' },
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🎯 วัตถุประสงค์:', size: 'xs', color: '#64748B', flex: 2 },
                  { type: 'text', text: data.purpose || 'ใช้งานทั่วไป', size: 'xs', color: '#1E293B', flex: 4, align: 'end', wrap: true },
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🕒 เวลาบันทึก:', size: 'xs', color: '#64748B', flex: 2 },
                  { type: 'text', text: timeStr, size: 'xs', color: '#64748B', flex: 4, align: 'end' },
                ]
              },
            ]
          }
        ],
      },
    },
  };
};

/**
 * Build Test Flex Message
 */
export const createTestFlexMessage = () => {
  const timeStr = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    type: 'flex',
    altText: '🚀 การทดสอบระบบแจ้งเตือน LINE สำเร็จ!',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#06C755', // Official LINE Green
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: '🚀 เชื่อมต่อ LINE สำเร็จแล้ว!',
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ENG SMART STORE • Notification Center',
            color: '#FFFFFFCC',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: 'ระบบพร้อมส่งการแจ้งเตือน',
            weight: 'bold',
            size: 'md',
            color: '#1E293B',
          },
          {
            type: 'text',
            text: 'ระบบพร้อมส่งข้อความแจ้งเตือนอัตโนมัติเมื่อเกิดรายการต่อไปนี้:',
            size: 'xs',
            color: '#64748B',
            margin: 'sm',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '• 📤 การเบิกสินค้า (Stock Out)',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: '• 📥 การรับเข้าสินค้า (Stock In)',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: '• 🟢 การเข้าสู่ระบบ (User Login)',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: '• 🔴 การออกจากระบบ (User Logout)',
                size: 'xs',
                color: '#334155',
              },
            ],
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#E2E8F0',
          },
          {
            type: 'text',
            text: `ทดสอบเมื่อ: ${timeStr}`,
            size: 'xxs',
            color: '#94A3B8',
            margin: 'md',
            align: 'end',
          },
        ],
      },
    },
  };
};
