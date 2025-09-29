// Bot commands
export enum BotCommand {
  START = '/start',
  ADMIN = '/admin',
  SUPPORT = '/support',
  STATS = '/stats',
  HELP = '/help',
  PROFILE = '/profile',
  ORDERS = '/orders',
  BALANCE = '/balance'
}

// Callback actions for inline keyboards
export enum CallbackAction {
  // Main menu actions
  SEND_PACKAGE = 'send_package',
  BUY_PRODUCT = 'buy_product',
  VIEW_WAREHOUSES = 'view_warehouses',
  VIEW_PROFILE = 'view_profile',
  
  // Order actions
  CREATE_SHIPPING_ORDER = 'create_shipping',
  CREATE_PURCHASE_ORDER = 'create_purchase',
  TRACK_ORDER = 'track_order',
  VIEW_ORDER = 'view_order',
  CANCEL_ORDER = 'cancel_order',
  
  // Country and warehouse actions
  SELECT_COUNTRY = 'select_country',
  VIEW_WAREHOUSE = 'view_warehouse',
  CALCULATE_COST = 'calculate_cost',
  
  // Product actions
  SELECT_CATEGORY = 'select_category',
  VIEW_PRODUCT = 'view_product',
  ADD_TO_CART = 'add_to_cart',
  
  // Payment actions
  PAY_CARD = 'pay_card',
  PAY_SBP = 'pay_sbp',
  PAY_CRYPTO = 'pay_crypto',
  PAY_BALANCE = 'pay_balance',
  TOP_UP_BALANCE = 'top_up_balance',
  
  // Profile actions
  EDIT_PROFILE = 'edit_profile',
  ADD_ADDRESS = 'add_address',
  EDIT_ADDRESS = 'edit_address',
  DELETE_ADDRESS = 'delete_address',
  
  // Support actions
  CONTACT_SUPPORT = 'contact_support',
  RATE_SUPPORT = 'rate_support',
  CLOSE_CHAT = 'close_chat',
  
  // Admin actions
  ADMIN_DASHBOARD = 'admin_dashboard',
  ADMIN_ORDERS = 'admin_orders',
  ADMIN_USERS = 'admin_users',
  ADMIN_COUNTRIES = 'admin_countries',
  ADMIN_ANALYTICS = 'admin_analytics',
  ADMIN_SUPPORT = 'admin_support',
  ADMIN_SETTINGS = 'admin_settings',
  
  // Order management
  ADMIN_APPROVE_ORDER = 'admin_approve_order',
  ADMIN_REJECT_ORDER = 'admin_reject_order',
  ADMIN_UPDATE_STATUS = 'admin_update_status',
  ADMIN_ADD_COMMENT = 'admin_add_comment',
  
  // User management
  ADMIN_BLOCK_USER = 'admin_block_user',
  ADMIN_UNBLOCK_USER = 'admin_unblock_user',
  ADMIN_MAKE_VIP = 'admin_make_vip',
  ADMIN_REMOVE_VIP = 'admin_remove_vip',
  
  // Pagination
  NEXT_PAGE = 'next_page',
  PREV_PAGE = 'prev_page',
  FIRST_PAGE = 'first_page',
  LAST_PAGE = 'last_page',
  
  // Generic actions
  BACK = 'back',
  CANCEL = 'cancel',
  CONFIRM = 'confirm',
  REFRESH = 'refresh'
}

// Bot scenes for conversation flow
export enum BotScene {
  // User registration
  REGISTRATION = 'registration',
  EDIT_PROFILE = 'edit_profile',
  ADD_ADDRESS = 'add_address',
  
  // Order creation
  CREATE_SHIPPING_ORDER = 'create_shipping_order',
  CREATE_PURCHASE_ORDER = 'create_purchase_order',
  TRACK_ORDER = 'track_order',
  
  // Payment
  TOP_UP_BALANCE = 'top_up_balance',
  PAYMENT_PROCESS = 'payment_process',
  
  // Support
  SUPPORT_CHAT = 'support_chat',
  RATE_SERVICE = 'rate_service',
  
  // Admin
  ADMIN_ORDER_MANAGEMENT = 'admin_order_management',
  ADMIN_USER_MANAGEMENT = 'admin_user_management',
  ADMIN_ADD_COUNTRY = 'admin_add_country',
  ADMIN_ADD_PRODUCT = 'admin_add_product'
}

// Notification types
export enum NotificationType {
  ORDER_STATUS_UPDATE = 'order_status_update',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  ORDER_DELIVERED = 'order_delivered',
  VIP_EXPIRED = 'vip_expired',
  BALANCE_LOW = 'balance_low',
  SUPPORT_MESSAGE = 'support_message',
  PROMOTION = 'promotion',
  SYSTEM_MAINTENANCE = 'system_maintenance'
}

// User activity types
export enum UserActivity {
  LOGIN = 'login',
  ORDER_CREATED = 'order_created',
  PAYMENT_MADE = 'payment_made',
  SUPPORT_CONTACTED = 'support_contacted',
  PROFILE_UPDATED = 'profile_updated',
  ADDRESS_ADDED = 'address_added'
}

// System settings keys
export enum SettingKey {
  // General
  SYSTEM_NAME = 'system_name',
  SYSTEM_VERSION = 'system_version',
  MAINTENANCE_MODE = 'maintenance_mode',
  
  // Payments
  MIN_TOP_UP_AMOUNT = 'min_top_up_amount',
  MAX_TOP_UP_AMOUNT = 'max_top_up_amount',
  CARD_COMMISSION = 'card_commission',
  SBP_COMMISSION = 'sbp_commission',
  VIP_CASHBACK = 'vip_cashback',
  
  // Orders
  MAX_PACKAGE_WEIGHT = 'max_package_weight',
  MAX_DECLARED_VALUE = 'max_declared_value',
  ORDER_TIMEOUT_HOURS = 'order_timeout_hours',
  
  // Support
  SUPPORT_PHONE = 'support_phone',
  SUPPORT_EMAIL = 'support_email',
  AUTO_ASSIGN_CHATS = 'auto_assign_chats',
  MAX_CHATS_PER_OPERATOR = 'max_chats_per_operator',
  
  // Telegram
  BOT_TOKEN = 'bot_token',
  WEBHOOK_URL = 'webhook_url',
  WEBHOOK_SECRET = 'webhook_secret'
}