import datetime as dt
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database import Base


class Floor(Base):
    __tablename__ = "floors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    rooms = relationship("Room", back_populates="floor", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    number = Column(String, nullable=False, index=True)
    floor_id = Column(Integer, ForeignKey("floors.id"), nullable=False)
    bed_count = Column(Integer, default=1)
    attached_bathroom = Column(Boolean, default=False)
    ac = Column(Boolean, default=False)
    balcony = Column(Boolean, default=False)
    monthly_rent = Column(Float, default=0)
    deposit_amount = Column(Float, default=0)
    status = Column(String, default="Vacant")  # Vacant, Occupied, Reserved, Maintenance
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    floor = relationship("Floor", back_populates="rooms")
    beds = relationship("Bed", back_populates="room", cascade="all, delete-orphan")


class Bed(Base):
    __tablename__ = "beds"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    label = Column(String, nullable=False)  # e.g. "Bed 1"
    status = Column(String, default="Vacant")  # Vacant, Occupied

    room = relationship("Room", back_populates="beds")
    tenant = relationship("Tenant", back_populates="bed", uselist=False)


class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    father_name = Column(String)
    gender = Column(String)
    dob = Column(Date, nullable=True)
    phone = Column(String)
    whatsapp = Column(String)
    emergency_contact = Column(String)
    email = Column(String)
    aadhaar = Column(String)
    pan = Column(String)
    driving_license = Column(String)
    occupation = Column(String)
    company = Column(String)
    office_address = Column(Text)
    permanent_address = Column(Text)
    current_address = Column(Text)
    joining_date = Column(Date, nullable=True)
    leaving_date = Column(Date, nullable=True)
    rent_amount = Column(Float, default=0)
    deposit = Column(Float, default=1500)
    advance_paid = Column(Float, default=0)
    due_amount = Column(Float, default=0)
    payment_mode = Column(String)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    bed_id = Column(Integer, ForeignKey("beds.id"), nullable=True)
    status = Column(String, default="Active")  # Active, Notice Given, Vacated
    photo_path = Column(String, nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    room = relationship("Room")
    bed = relationship("Bed", back_populates="tenant")
    payments = relationship("RentPayment", back_populates="tenant", cascade="all, delete-orphan")


class Staff(Base):
    __tablename__ = "staff"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Chef, Sweeper, Watchman, etc.
    phone = Column(String)
    monthly_salary = Column(Float, default=0)
    advance_paid = Column(Float, default=0)
    joining_date = Column(Date, nullable=True)
    status = Column(String, default="Active")
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    attendance = relationship("StaffAttendance", back_populates="staff", cascade="all, delete-orphan")


class StaffAttendance(Base):
    __tablename__ = "staff_attendance"
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, default="Present")  # Present, Absent, Half Day, Leave

    staff = relationship("Staff", back_populates="attendance")


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False)
    description = Column(String)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False, default=dt.date.today)
    payment_mode = Column(String, default="Cash")
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class Income(Base):
    __tablename__ = "income"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False)  # Security Deposit, Advance, Penalty, Late Fee, Parking Fee, Other
    description = Column(String)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False, default=dt.date.today)
    payment_mode = Column(String, default="Cash")
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class RentPayment(Base):
    __tablename__ = "rent_payments"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    month = Column(String, nullable=False)  # "2026-07"
    amount_due = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0)
    late_fee = Column(Float, default=0)
    payment_mode = Column(String, default="Cash")
    payment_date = Column(Date, nullable=True)
    status = Column(String, default="Pending")  # Paid, Partially Paid, Pending
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="payments")
    txns = relationship("RentPaymentTxn", back_populates="rent_payment", cascade="all, delete-orphan")


class RentPaymentTxn(Base):
    """A single dated installment against a RentPayment (one tenant/month rent record
    can be paid across several actual transactions)."""
    __tablename__ = "rent_payment_txns"
    id = Column(Integer, primary_key=True, index=True)
    rent_payment_id = Column(Integer, ForeignKey("rent_payments.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_mode = Column(String, default="Cash")
    payment_date = Column(Date, nullable=False, default=dt.date.today)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    rent_payment = relationship("RentPayment", back_populates="txns")


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(Text)
