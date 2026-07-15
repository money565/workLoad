import paramiko, io, time, subprocess

views_content = """from django.http import JsonResponse
from django.views import View
from local_server.apps.publicMesg.models import PublicMesgEmpList, PublicMesgProjectList
from .models import WorkPlanWorks, Position, StaffDispatch, WorkExecution, WorkStandard
import json


class EmpListByProject(View):
    def get(self, request, pid):
        pid = int(pid); result = []
        try:
            emps = PublicMesgEmpList.objects.filter(project_id=pid)
            for e in emps:
                result.append({"id":e.id,"name":e.name,"depName":e.depName,"posit":e.posit,"mobile":e.mobile or "","userid":e.userid,"avatar":e.avatar or "","state":e.state})
        except Exception: pass
        return JsonResponse({"code":200,"result":result})

class WorkPlanList(View):
    def get(self, request, pid):
        pid=int(pid); result=[]
        try:
            for p in WorkPlanWorks.objects.filter(project_id=pid):
                result.append({"id":p.id,"work_name":p.work_name,"price":float(p.price),"salary":float(p.salary),"feq":p.feq,"unit":p.unit,"number":p.number,"work_hours_float":p.work_hours_float,"start_time":p.start_time.isoformat() if p.start_time else None,"end_time":p.end_time.isoformat() if p.end_time else None,"work_type":p.work_type,"work_cycle":p.work_cycle,"exec_time":p.exec_time,"status":p.status,"record_time":json.loads(p.record_time) if p.record_time else []})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
        return JsonResponse({"code":200,"result":result})
    def post(self, request, pid):
        try:
            data=json.loads(request.body); rt=data.get("record_time",[]); rt_str=json.dumps(rt) if rt and isinstance(rt,list) else ""
            plan=WorkPlanWorks.objects.create(project_id=int(pid),work_name=data.get("work_name",""),price=data.get("price",0),salary=data.get("salary",0),feq=data.get("feq",""),unit=data.get("unit",""),number=data.get("number",0),work_hours_float=data.get("work_hours_float",0.0),start_time=data.get("start_time") or None,end_time=data.get("end_time") or None,work_type=data.get("work_type",0),work_cycle=data.get("work_cycle",0),exec_time=data.get("exec_time",-1),record_time=rt_str,status=data.get("status",0))
            return JsonResponse({"code":200,"msg":"ok","id":plan.id})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class WorkPlanDetail(View):
    def get(self, request, pk):
        try:
            p=WorkPlanWorks.objects.get(id=int(pk))
            return JsonResponse({"code":200,"result":{"id":p.id,"work_name":p.work_name,"price":float(p.price),"salary":float(p.salary),"feq":p.feq,"unit":p.unit,"number":p.number,"start_time":p.start_time.isoformat() if p.start_time else None,"end_time":p.end_time.isoformat() if p.end_time else None,"work_type":p.work_type,"work_cycle":p.work_cycle,"exec_time":p.exec_time,"status":p.status,"record_time":json.loads(p.record_time) if p.record_time else []}})
        except WorkPlanWorks.DoesNotExist: return JsonResponse({"code":404})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
    def put(self, request, pk):
        try:
            data=json.loads(request.body); obj=WorkPlanWorks.objects.filter(id=int(pk)); kwargs={}
            fm={"work_name":"","price":0,"salary":0,"feq":"","unit":"","number":0,"work_hours_float":0.0,"work_type":0,"work_cycle":0,"exec_time":-1,"status":0}
            for f,dv in fm.items():
                if f in data: kwargs[f]=data.get(f,dv)
            if "start_time" in data: kwargs["start_time"]=data["start_time"] or None
            if "end_time" in data: kwargs["end_time"]=data["end_time"] or None
            if "record_time" in data: rt=data["record_time"]; kwargs["record_time"]=json.dumps(rt) if rt else ""
            if "project_id" in data: kwargs["project_id"]=int(data["project_id"])
            if kwargs: obj.update(**kwargs)
            return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
    def delete(self, request, pk):
        try: WorkPlanWorks.objects.filter(id=int(pk)).delete(); return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class PositionList(View):
    def get(self, request, pid):
        pid=int(pid); result=[]
        try:
            for p in Position.objects.filter(project_id=pid):
                result.append({"id":p.id,"name":p.name,"project_id":p.project_id,"works":[w.id for w in p.works.all()],"work_names":[w.work_name for w in p.works.all()],"status":p.status,"created_at":p.created_at.isoformat()})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
        return JsonResponse({"code":200,"result":result})
    def post(self, request, pid):
        try:
            data=json.loads(request.body); pos=Position.objects.create(project_id=int(pid),name=data.get("name",""),status=data.get("status",0))
            if data.get("work_ids"): pos.works.set(data["work_ids"])
            return JsonResponse({"code":200,"msg":"ok","id":pos.id})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class PositionDetail(View):
    def put(self, request, pk):
        try:
            data=json.loads(request.body); pos=Position.objects.filter(id=int(pk)); kwargs={}
            if "name" in data: kwargs["name"]=data["name"]
            if "status" in data: kwargs["status"]=data["status"]
            if "project_id" in data: kwargs["project_id"]=int(data["project_id"])
            if kwargs: pos.update(**kwargs)
            pos2=pos.first()
            if pos2 and "work_ids" in data: pos2.works.set(data["work_ids"])
            return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
    def delete(self, request, pk):
        try: Position.objects.filter(id=int(pk)).delete(); return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class StaffDispatchList(View):
    def get(self, request, pid):
        pid=int(pid); result=[]
        try:
            for s in StaffDispatch.objects.filter(project_id=pid):
                result.append({"id":s.id,"project_id":s.project_id,"emp_ids":[e.id for e in s.emps.all()],"emp_names":[e.name for e in s.emps.all()],"position_ids":[p.id for p in s.positions.all()],"position_names":[p.name for p in s.positions.all()],"status":s.status,"created_at":s.created_at.isoformat()})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
        return JsonResponse({"code":200,"result":result})
    def post(self, request, pid):
        try:
            data=json.loads(request.body); sd=StaffDispatch.objects.create(project_id=int(pid),status=data.get("status",0))
            if data.get("emp_ids"): sd.emps.set(data["emp_ids"])
            if data.get("position_ids"): sd.positions.set(data["position_ids"])
            return JsonResponse({"code":200,"msg":"ok","id":sd.id})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class StaffDispatchDetail(View):
    def put(self, request, pk):
        try:
            data=json.loads(request.body); sd=StaffDispatch.objects.filter(id=int(pk)); kwargs={}
            if "status" in data: kwargs["status"]=data["status"]
            if "project_id" in data: kwargs["project_id"]=int(data["project_id"])
            if kwargs: sd.update(**kwargs)
            sd2=sd.first()
            if sd2:
                if "emp_ids" in data: sd2.emps.set(data["emp_ids"])
                if "position_ids" in data: sd2.positions.set(data["position_ids"])
            return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
    def delete(self, request, pk):
        try: StaffDispatch.objects.filter(id=int(pk)).delete(); return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class WorkExecutionList(View):
    def get(self, request, pid):
        pid=int(pid); result=[]
        try:
            for e in WorkExecution.objects.filter(project_id=pid):
                result.append({"id":e.id,"project_id":e.project_id,"work_plan_id":e.work_plan_id,"work_plan_name":e.work_plan.work_name,"executor_id":e.executor_id,"executor_name":e.executor.name if e.executor else "","image":e.image,"uploader_id":e.uploader_id,"uploader_name":e.uploader.name if e.uploader else "","upload_time":e.upload_time.isoformat() if e.upload_time else None,"check_result":e.check_result,"remark":e.remark,"check_image":e.check_image,"check_time":e.check_time.isoformat() if e.check_time else None,"checker_id":e.checker_id,"checker_name":e.checker.name if e.checker else ""})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
        return JsonResponse({"code":200,"result":result})
    def post(self, request, pid):
        try:
            data=json.loads(request.body); exe=WorkExecution.objects.create(project_id=int(pid),work_plan_id=data.get("work_plan_id"),executor_id=data.get("executor_id") or None,image=data.get("image",""),uploader_id=data.get("uploader_id") or None,remark=data.get("remark",""),check_image=data.get("check_image",""),checker_id=data.get("checker_id") or None,check_result=data.get("check_result",0),check_time=data.get("check_time") or None)
            return JsonResponse({"code":200,"msg":"ok","id":exe.id})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class WorkExecutionDetail(View):
    def put(self, request, pk):
        try:
            data=json.loads(request.body); obj=WorkExecution.objects.filter(id=int(pk)); kwargs={}
            for f in ["work_plan_id","executor_id","image","uploader_id","remark","check_image","checker_id","check_result","project_id"]:
                if f in data: kwargs[f]=data[f] or None
            if "check_time" in data: kwargs["check_time"]=data["check_time"] or None
            if kwargs: obj.update(**kwargs)
            return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
    def delete(self, request, pk):
        try: WorkExecution.objects.filter(id=int(pk)).delete(); return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class MobileScanView(View):
    def get(self, request, userid):
        try:
            emp=PublicMesgEmpList.objects.filter(userid=userid).first()
            if not emp: return JsonResponse({"code":404,"msg":"not found"})
            dispatches=StaffDispatch.objects.filter(emps=emp,status=0)
            if not dispatches.exists(): return JsonResponse({"code":200,"msg":"not assigned","result":[]})
            wid=request.GET.get("wid"); result=[]
            for d in dispatches:
                for pos in d.positions.filter(status=0):
                    works=pos.works.filter(id=int(wid)) if wid else pos.works.all()
                    for w in works:
                        result.append({"work_id":w.id,"work_name":w.work_name,"price":float(w.price),"salary":float(w.salary),"feq":w.feq,"unit":w.unit,"number":w.number,"start_time":w.start_time.isoformat() if w.start_time else None,"end_time":w.end_time.isoformat() if w.end_time else None,"work_type":w.work_type,"work_cycle":w.work_cycle,"exec_time":w.exec_time,"position_name":pos.name,"project_name":d.project.name})
            return JsonResponse({"code":200,"result":result})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class WorkStandardView(View):
    def get(self, request, pid):
        try:
            items=WorkStandard.objects.filter(project_id=int(pid))
            result=[{"id":s.id,"name":s.name,"content":json.loads(s.content) if s.content else [],"status":s.status,"created_at":s.created_at.isoformat(),"work_ids":[w.id for w in s.works.all()],"work_names":[w.work_name for w in s.works.all()]} for s in items]
            return JsonResponse({"code":200,"result":result})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
    def post(self, request, pid=None):
        try:
            data=json.loads(request.body); ca=data.get("content",[]); cs=json.dumps(ca) if isinstance(ca,list) else ca
            s=WorkStandard.objects.create(project_id=int(pid),name=data.get("name",""),content=cs,status=data.get("status",0))
            if data.get("work_ids"): s.works.set(data["work_ids"])
            return JsonResponse({"code":200,"msg":"ok","id":s.id})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class WorkStandardDetail(View):
    def put(self, request, pk):
        try:
            data=json.loads(request.body); obj=WorkStandard.objects.filter(id=int(pk)); kw={}
            for f in ["name","content","status","project_id"]:
                if f in data:
                    if f=="content" and isinstance(data[f],list): kw[f]=json.dumps(data[f])
                    elif f=="project_id": kw[f]=int(data[f])
                    else: kw[f]=data[f]
            if kw: obj.update(**kw)
            obj2=obj.first()
            if obj2 and "work_ids" in data: obj2.works.set(data["work_ids"])
            return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
    def delete(self, request, pk):
        try: WorkStandard.objects.filter(id=int(pk)).delete(); return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})

class DebugTableView(View):
    def delete(self, request, pid, table, pk):
        try:
            from django.apps import apps
            tables={"workplan":"WorkPlanWorks","position":"Position","staffdispatch":"StaffDispatch","execution":"WorkExecution","standard":"WorkStandard"}
            if table not in tables: return JsonResponse({"code":404})
            model=apps.get_model("workLoad",tables[table]); model.objects.filter(id=int(pk)).delete()
            return JsonResponse({"code":200,"msg":"ok"})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
    def get(self, request, pid, table):
        try:
            from django.apps import apps
            tables={"workplan":"WorkPlanWorks","position":"Position","staffdispatch":"StaffDispatch","execution":"WorkExecution","standard":"WorkStandard"}
            if table not in tables: return JsonResponse({"code":404})
            model=apps.get_model("workLoad",tables[table]); qs=model.objects.all(); rows=[]
            for obj in qs[:100]:
                row={}
                for f in obj._meta.fields: val=getattr(obj,f.name); row[f.name]=str(val) if val is not None else None
                rows.append(row)
            return JsonResponse({"code":200,"result":rows,"count":qs.count()})
        except Exception as e: return JsonResponse({"code":500,"msg":str(e)})
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(hostname='tanghui.iego.vip', port=46070, username='xcserver', password='1', timeout=30, allow_agent=False, look_for_keys=False)

sf = c.open_sftp()
sf.putfo(io.BytesIO(views_content.encode('utf-8')), '/home/xcserver/local_server/local_server/apps/workLoad/views.py')
sf.close()

# Verify
si, so, se = c.exec_command('grep "^class " /home/xcserver/local_server/local_server/apps/workLoad/views.py | wc -l')
print('Class count:', so.read().decode().strip())

# Restart
c.exec_command('fuser -k 8080/tcp 2>/dev/null')
time.sleep(2)
c.exec_command('find /home/xcserver/local_server/local_server -name __pycache__ -exec rm -rf {} + 2>/dev/null')
c.exec_command('cd /home/xcserver/local_server && source /home/xcserver/venv/bin/activate && uwsgi --ini local_server/uwsgi.ini')
time.sleep(4)

r = subprocess.run(['curl','-s','https://www.cdxcwy.cn/api/workLoad/workPlans/13'],capture_output=True,text=True,timeout=10)
print('WorkPlans:', r.stdout[:100])
r2 = subprocess.run(['curl','-s','https://www.cdxcwy.cn/api/workLoad/standards/13'],capture_output=True,text=True,timeout=10)
print('Standards:', r2.stdout[:100])
c.close()
