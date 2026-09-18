"""All Pydantic models for EverGro eMart."""
from datetime import datetime, timezone
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict, EmailStr
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


class Base(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# ============ User ============
class UserCreate(Base):
    name: str
    email: EmailStr
    phone: str
    password: str
    username: Optional[str] = None  # Instagram-style unique handle
    referral_code: Optional[str] = None  # sponsor's code
    terms_accepted: bool = False


class UserLogin(Base):
    identifier: str  # email or phone
    password: str


class OTPSendReq(Base):
    phone: str


class OTPVerifyReq(Base):
    phone: str
    otp: str


class ForgotPwReq(Base):
    phone: str
    otp: str
    new_password: str
    user_code: Optional[str] = None  # required when phone has multiple accounts


class User(Base):
    id: str = Field(default_factory=new_id)
    user_code: str  # e.g. EG000001
    name: str
    email: str
    phone: str
    password_hash: str = ""
    role: str = "user"  # user | sub_admin | super_admin
    sponsor_id: Optional[str] = None  # parent user_code
    sponsor_user_id: Optional[str] = None
    referral_code: str
    current_stage: int = 1
    direct_referrals_count: int = 0
    team_size: int = 0
    wallet_balance: float = 0.0
    income_wallet: float = 0.0
    commission_wallet: float = 0.0
    cashback_wallet: float = 0.0
    reward_wallet: float = 0.0
    total_earnings: float = 0.0
    kyc_status: str = "pending"  # pending|approved|rejected|not_submitted
    avatar_url: Optional[str] = None
    is_active: bool = True
    permissions: List[str] = Field(default_factory=list)
    joined_at_stage1: int = 0  # count of joins at current stage
    cycle_count: int = 0
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class PublicUser(Base):
    id: str
    user_code: str
    name: str
    email: str
    phone: str
    role: str
    sponsor_id: Optional[str] = None
    referral_code: str
    current_stage: int
    direct_referrals_count: int
    team_size: int
    wallet_balance: float
    income_wallet: float
    commission_wallet: float
    cashback_wallet: float
    reward_wallet: float
    total_earnings: float
    kyc_status: str
    avatar_url: Optional[str] = None
    is_active: bool
    permissions: List[str] = []
    cycle_count: int = 0


# ============ Product / Hamper ============
class ProductCreate(Base):
    name: str
    description: str = ""
    price: float
    mrp: float = 0
    sku: str = ""
    category: str = "general"
    brand: str = ""
    gst_percent: float = 5.0
    stock: int = 100
    images: List[str] = []
    videos: List[str] = []
    pdfs: List[str] = []
    badges: List[str] = []  # bestseller|featured|trending|new|limited
    is_hamper: bool = False
    hamper_tier: Optional[str] = None  # Bronze|Silver|Gold|Platinum
    contents: List[str] = []
    # Fashion variants — optional lists shown as pickers on the product page.
    sizes: List[str] = []   # e.g. ["S","M","L","XL"]
    colors: List[str] = []  # e.g. ["Red","White","Black"] or hex codes
    is_active: bool = True
    is_locked: bool = False  # locked hampers can't be purchased


class Product(ProductCreate):
    id: str = Field(default_factory=new_id)
    rating: float = 4.5
    review_count: int = 0
    created_at: str = Field(default_factory=now_iso)


class Review(Base):
    id: str = Field(default_factory=new_id)
    product_id: str
    user_id: str
    user_name: str
    rating: int
    comment: str
    created_at: str = Field(default_factory=now_iso)


# ============ Cart / Order ============
class CartItem(Base):
    product_id: str
    quantity: int = 1


class CartAdd(Base):
    product_id: str
    quantity: int = 1
    size: Optional[str] = None
    color: Optional[str] = None


class OrderCreate(Base):
    items: List[CartItem]
    address: dict
    coupon_code: Optional[str] = None
    payment_method: str = "razorpay"


class Order(Base):
    id: str = Field(default_factory=new_id)
    order_code: str
    user_id: str
    items: List[dict]
    subtotal: float
    discount: float = 0
    gst: float = 0
    shipping: float = 0
    total: float
    address: dict
    coupon_code: Optional[str] = None
    payment_method: str = "razorpay"
    payment_status: str = "pending"  # pending|paid|failed
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    status: str = "placed"  # placed|confirmed|shipped|delivered|cancelled
    tracking_no: Optional[str] = None
    is_joining_order: bool = False
    created_at: str = Field(default_factory=now_iso)


class PaymentVerify(Base):
    order_id: str
    razorpay_payment_id: str = "mock_payment"
    razorpay_signature: str = "mock_signature"


# ============ Wallet / Transaction ============
class Transaction(Base):
    id: str = Field(default_factory=new_id)
    user_id: str
    user_code: str = ""
    type: str  # credit|debit
    category: str  # commission|cashback|reward|withdrawal|order|refund
    amount: float
    wallet: str = "income"  # income|commission|cashback|reward
    description: str = ""
    reference_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ============ Withdrawal ============
class WithdrawalReq(Base):
    amount: float
    method: str = "upi"  # upi|bank
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc: Optional[str] = None
    account_holder: Optional[str] = None


class Withdrawal(Base):
    id: str = Field(default_factory=new_id)
    withdrawal_code: str
    user_id: str
    user_code: str
    user_name: str = ""
    amount: float
    method: str
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc: Optional[str] = None
    account_holder: Optional[str] = None
    status: str = "pending"  # pending|approved|rejected|paid|hold
    admin_note: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    processed_at: Optional[str] = None


# ============ KYC ============
class KYCSubmit(Base):
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    passport_number: Optional[str] = None
    aadhaar_doc: Optional[str] = None  # cloudinary url
    pan_doc: Optional[str] = None
    passport_doc: Optional[str] = None
    selfie: Optional[str] = None


class KYC(Base):
    id: str = Field(default_factory=new_id)
    user_id: str
    user_code: str
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    passport_number: Optional[str] = None
    aadhaar_doc: Optional[str] = None
    pan_doc: Optional[str] = None
    passport_doc: Optional[str] = None
    selfie: Optional[str] = None
    status: str = "pending"
    admin_note: Optional[str] = None
    submitted_at: str = Field(default_factory=now_iso)
    reviewed_at: Optional[str] = None


# ============ Notifications ============
class Notification(Base):
    id: str = Field(default_factory=new_id)
    user_id: str  # "*" for broadcast
    title: str
    body: str
    type: str = "info"  # info|success|warning|error
    event: Optional[str] = None
    read: bool = False
    created_at: str = Field(default_factory=now_iso)


# ============ Settings ============
class MLMSettings(Base):
    stages_total: int = 8
    referrals_per_stage: int = 3
    joining_amount: float = 2999.0
    stage_commissions: List[float] = [500, 0, 1500, 0, 5000, 0, 15000, 50000]
    commission_stages: List[int] = [1, 3, 5, 7, 8]


class SiteSettings(Base):
    logo_url: str = ""
    favicon_url: str = ""
    site_name: str = "EverGro eMart"
    tagline: str = "Premium products, delivered with care"
    phone: str = "+91-9000000000"
    email: str = "support@evergroemart.com"
    address: str = "India"
    whatsapp: str = "+919000000000"
    facebook: str = ""
    instagram: str = ""
    twitter: str = ""
    youtube: str = ""
    notification_bar_text: str = "🎉 Welcome to EverGro eMart — Free shipping on orders above ₹999!"
    notification_bar_enabled: bool = True
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_enabled: bool = False
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    meta_pixel_id: str = ""
    meta_pixel_code: str = ""
    # Payment gateway master toggle — admin picks which gateway is live.
    # Values: "none" (default = online payments disabled), "uropay", "razorpay", "manual"
    active_payment_gateway: str = "none"
    # Admin can disable Cash-on-Delivery via this flag. Default: COD is ON.
    cod_disabled: bool = False


class Banner(Base):
    id: str = Field(default_factory=new_id)
    title: str
    subtitle: str = ""
    image_url: str
    link: str = "#"
    position: str = "hero"  # hero|promo|popup
    is_active: bool = True
    sort_order: int = 0
    created_at: str = Field(default_factory=now_iso)


class Slider(Base):
    id: str = Field(default_factory=new_id)
    title: str = ""
    subtitle: str = ""
    image_url: str
    link: str = "#"
    cta_label: str = ""
    location: str = "landing_top"  # landing_top|landing_mid|user_dashboard
    is_active: bool = True
    sort_order: int = 0
    created_at: str = Field(default_factory=now_iso)


class ReelVideo(Base):
    id: str = Field(default_factory=new_id)
    title: str
    video_url: str  # mp4 url, ideally 9:16
    thumbnail_url: str = ""
    description: str = ""
    location: str = "both"  # landing|user|both
    is_active: bool = True
    sort_order: int = 0
    created_at: str = Field(default_factory=now_iso)


class AuditLog(Base):
    id: str = Field(default_factory=new_id)
    actor_id: Optional[str] = None
    actor_code: Optional[str] = None
    actor_role: Optional[str] = None
    event: str  # login|register|payment|withdrawal_request|withdrawal_decision|kyc_submit|kyc_decision|role_change|status_change|broadcast|settings_update
    target_id: Optional[str] = None
    target_label: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    ip: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Coupon(Base):
    id: str = Field(default_factory=new_id)
    code: str
    discount_percent: float = 0
    discount_amount: float = 0
    min_order: float = 0
    max_discount: float = 0
    is_active: bool = True
    expires_at: Optional[str] = None


class SupportTicket(Base):
    id: str = Field(default_factory=new_id)
    ticket_code: str
    user_id: str
    user_name: str = ""
    subject: str
    message: str
    status: str = "open"  # open|in_progress|resolved|closed
    admin_reply: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Blog(Base):
    id: str = Field(default_factory=new_id)
    title: str
    slug: str
    excerpt: str = ""
    content: str
    cover_image: str = ""
    author: str = "EverGro Team"
    is_published: bool = True
    created_at: str = Field(default_factory=now_iso)


class Testimonial(Base):
    id: str = Field(default_factory=new_id)
    name: str
    role: str = "Member"
    avatar: str = ""
    rating: int = 5
    message: str
    is_active: bool = True


class FAQ(Base):
    id: str = Field(default_factory=new_id)
    question: str
    answer: str
    sort_order: int = 0
    is_active: bool = True
