from typing import List, Optional, Any
from pydantic import BaseModel

class GoalPayload(BaseModel):
    tags: List[str]
    goal_details: dict

class FormOnboardPayload(BaseModel):
    session_id: str
    form_data: dict

class AuthPayload(BaseModel):
    user_id: str
    password: str
    name: Optional[str] = ""

class ProfilePayload(BaseModel):
    user_id: str
    form_data: dict

class GenSubjectsPayload(BaseModel):
    user_goal: dict
    tags: list

class GenSubjectWeightsPayload(BaseModel):
    subjects: list
    user_goal: dict

class GenUnitsPayload(BaseModel):
    subjects: list
    user_goal: dict

class GenUnitWeightsPayload(BaseModel):
    subjects_with_units: list
    user_goal: dict

class GenerateScheduleFinalPayload(BaseModel):
    form_data: dict
    ai_draft: dict
    session_id: str

class RecommendTextbooksPayload(BaseModel):
    user_goal: Any

class TaskVerifyPayload(BaseModel):
    session_id: str
    task_title: str
    one_line_summary: Optional[str] = ""
    actual_minutes: Optional[int] = 0

class ChatPayload(BaseModel):
    session_id: str
    message: str

class FinalizePayload(BaseModel):
    session_id: str

class UpdateWeightsPayload(BaseModel):
    session_id: str
    new_spreadsheet_data: dict

class ReschedulePayload(BaseModel):
    session_id: str
    schedule_id: str

class EvaluatePayload(BaseModel):
    session_id: str
    subject: str
    explanation: str

class RescheduleAutoPayload(BaseModel):
    session_id: str

class SaveAttendancePayload(BaseModel):
    session_id: str
    date: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    is_managed: bool = False
    consult_checked: bool = False
    consult_note: str = ''
    scheduled_in_time: Optional[str] = None
    scheduled_out_time: Optional[str] = None

class SaveMessagePayload(BaseModel):
    session_id: str
    sender_role: str
    content: str

class ConsultTagPayload(BaseModel):
    session_id: str
    date: str

class NfcTagPayload(BaseModel):
    session_id: str
    date: str

class TaskTogglePayload(BaseModel):
    week_number: int
    task_index: int
    completed: bool
