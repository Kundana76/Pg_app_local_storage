import datetime as dt
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Floor ----------
class FloorCreate(BaseModel):
    name: str


class FloorBulkCreate(BaseModel):
    count: int
    include_ground: bool = True
    start_at: int = 1  # "Floor 1", "Floor 2" ...


class FloorOut(ORMBase):
    id: int
    name: str


# ---------- Room ----------
class RoomCreate(BaseModel):
    number: str
    floor_id: int
    bed_count: int = 1
    attached_bathroom: bool = False
    ac: bool = False
    balcony: bool = False
    monthly_rent: float = 0
    deposit_amount: float = 0
    status: str = "Vacant"


class RoomBulkCreate(BaseModel):
    floor_id: int
    start: int
    end: int
    bed_count: int = 1
    attached_bathroom: bool = False
    ac: bool = False
    balcony: bool = False
    monthly_rent: float = 0
    deposit_amount: float = 0


class RoomUpdate(BaseModel):
    number: Optional[str] = None
    bed_count: Optional[int] = None
    attached_bathroom: Optional[bool] = None
    ac: Optional[bool] = None
    balcony: Optional[bool] = None
    monthly_rent: Optional[float] = None
    deposit_amount: Optional[float] = None
    status: Optional[str] = None


class RoomOut(ORMBase):
    id: int
    number: str
    floor_id: int
    bed_count: int
    attached_bathroom: bool
    ac: bool
    balcony: bool
    monthly_rent: float
    deposit_amount: float
    status: str


# ---------- Bed ----------
class BedOut(ORMBase):
    id: int
    room_id: int
    label: str
    status: str


# ---------- Tenant ----------
class TenantCreate(BaseModel):
    full_name: str
    father_name: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[dt.date] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    emergency_contact: Optional[str] = None
    email: Optional[str] = None
    aadhaar: Optional[str] = None
    pan: Optional[str] = None
    driving_license: Optional[str] = None
    occupation: Optional[str] = None
    company: Optional[str] = None
    office_address: Optional[str] = None
    permanent_address: Optional[str] = None
    current_address: Optional[str] = None
    joining_date: Optional[dt.date] = None
    leaving_date: Optional[dt.date] = None
    rent_amount: float = 0
    deposit: float = 1500
    advance_paid: float = 0
    due_amount: float = 0
    payment_mode: Optional[str] = "Cash"
    room_id: Optional[int] = None
    bed_id: Optional[int] = None
    status: str = "Active"
    notes: Optional[str] = None


class TenantUpdate(TenantCreate):
    full_name: Optional[str] = None


class TenantOut(TenantCreate, ORMBase):
    id: int


# ---------- Staff ----------
class StaffCreate(BaseModel):
    full_name: str
    role: str
    phone: Optional[str] = None
    monthly_salary: float = 0
    advance_paid: float = 0
    joining_date: Optional[dt.date] = None
    status: str = "Active"


class StaffUpdate(StaffCreate):
    full_name: Optional[str] = None
    role: Optional[str] = None


class StaffOut(StaffCreate, ORMBase):
    id: int


class AttendanceMark(BaseModel):
    staff_id: int
    date: dt.date
    status: str = "Present"


# ---------- Expense ----------
class ExpenseCreate(BaseModel):
    category: str
    description: Optional[str] = None
    amount: float
    date: dt.date
    payment_mode: str = "Cash"


class ExpenseOut(ExpenseCreate, ORMBase):
    id: int


# ---------- Income ----------
class IncomeCreate(BaseModel):
    category: str
    description: Optional[str] = None
    amount: float
    date: dt.date
    payment_mode: str = "Cash"
    tenant_id: Optional[int] = None


class IncomeOut(IncomeCreate, ORMBase):
    id: int


# ---------- Rent ----------
class RentGenerate(BaseModel):
    month: str  # "2026-07"


class RentPaymentUpdate(BaseModel):
    """Administrative edits only — recording an actual payment goes through
    RentPaymentPay so each installment is tracked individually."""
    late_fee: Optional[float] = None
    status: Optional[str] = None


class RentPaymentPay(BaseModel):
    amount: float
    payment_mode: str = "Cash"
    payment_date: dt.date
    late_fee: Optional[float] = None


class RentPaymentTxnOut(ORMBase):
    id: int
    rent_payment_id: int
    amount: float
    payment_mode: str
    payment_date: dt.date


class RentPaymentOut(ORMBase):
    id: int
    tenant_id: int
    month: str
    amount_due: float
    amount_paid: float
    late_fee: float
    payment_mode: str
    payment_date: Optional[dt.date] = None
    status: str


# ---------- Settings ----------
class SettingUpdate(BaseModel):
    key: str
    value: str
