const fs = require('fs');
const path = require('path');

// 1. Postman Environment definition
const environment = {
  id: "e1b2c3d4-race-horse-local-env",
  name: "Racehorse System - Local Environment",
  values: [
    { key: "baseUrl", value: "http://localhost:3000/api/v1", type: "default", enabled: true },
    { key: "managerEmail", value: "manager@racehorse.local", type: "default", enabled: true },
    { key: "managerPassword", value: "Manager123!", type: "default", enabled: true },
    { key: "trainerEmail", value: "trainer@racehorse.local", type: "default", enabled: true },
    { key: "trainerPassword", value: "Trainer123!", type: "default", enabled: true },
    { key: "groomEmail", value: "groom@racehorse.local", type: "default", enabled: true },
    { key: "groomPassword", value: "Groom123!", type: "default", enabled: true },
    { key: "vetEmail", value: "vet@racehorse.local", type: "default", enabled: true },
    { key: "vetPassword", value: "Vet123!", type: "default", enabled: true },
    { key: "ownerEmail", value: "owner1@racehorse.local", type: "default", enabled: true },
    { key: "ownerPassword", value: "Owner123!", type: "default", enabled: true },
    { key: "ownerId", value: "48bb5de3-507b-44e8-a191-a4f91fc8f44b", type: "default", enabled: true },
    { key: "existingHorseId", value: "29a1cab8-79fb-4e19-a82c-1e67a87fe2d0", type: "default", enabled: true },
    { key: "accessToken", value: "", type: "secret", enabled: true },
    { key: "trainerToken", value: "", type: "secret", enabled: true },
    { key: "groomToken", value: "", type: "secret", enabled: true },
    { key: "vetToken", value: "", type: "secret", enabled: true },
    { key: "createdHorseId", value: "", type: "default", enabled: true },
    { key: "createdSessionId", value: "", type: "default", enabled: true },
    { key: "createdCareId", value: "", type: "default", enabled: true },
    { key: "createdHealthRecordId", value: "", type: "default", enabled: true },
    { key: "createdRaceId", value: "", type: "default", enabled: true },
    { key: "createdIncidentId", value: "", type: "default", enabled: true }
  ],
  _postman_variable_scope: "environment"
};

// 2. Helper functions to build Postman requests
function makeHeader(hasAuth = true, tokenVar = "accessToken") {
  const headers = [
    { key: "Content-Type", value: "application/json" }
  ];
  if (hasAuth) {
    headers.push({
      key: "Authorization",
      value: `Bearer {{${tokenVar}}}`
    });
  }
  return headers;
}

function makeRequest(name, method, urlPath, query = [], body = null, headers = [], testScript = "", preScript = "") {
  const urlParts = urlPath.replace(/^\//, '').split('/');
  const item = {
    name: name,
    request: {
      method: method,
      header: headers,
      url: {
        raw: `{{baseUrl}}/${urlParts.join('/')}${query.length > 0 ? '?' + query.map(q => `${q.key}=${q.value}`).join('&') : ''}`,
        host: ["{{baseUrl}}"],
        path: urlParts,
        query: query
      }
    }
  };

  if (body) {
    item.request.body = {
      mode: "raw",
      raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
      options: {
        raw: {
          language: "json"
        }
      }
    };
  }

  item.event = [];
  if (preScript) {
    item.event.push({
      listen: "prerequest",
      script: {
        exec: preScript.trim().split("\n"),
        type: "text/javascript"
      }
    });
  }
  if (testScript) {
    item.event.push({
      listen: "test",
      script: {
        exec: testScript.trim().split("\n"),
        type: "text/javascript"
      }
    });
  }

  return item;
}

// 3. Define Comprehensive Business Logic Test Collection
const collection = {
  info: {
    _postman_id: "8f9a0b1c-racehorse-business-api-testing",
    name: "Racehorse Management System — Business Logic API Testing Suite",
    description: "Bộ kiểm thử API Nghiệp vụ chuyên sâu (Business Logic & End-to-End Workflows) cho môn Software Testing.\nBao quát các quy trình nghiệp vụ: Quản lý vòng đời ngựa, Đánh giá thể lực & Quy tắc tính điểm, Quy trình huấn luyện & An toàn, Chăm sóc & Dinh dưỡng, Y tế thú y & Tiêm chủng, Xử lý sự cố chuồng trại, Tổ chức giải đua và Phân quyền RBAC.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    // ==========================================
    // SUITE 01: KHỞI TẠO PHIÊN & XÁC THỰC ĐA VAI TRÒ
    // ==========================================
    {
      name: "01. Authentication & Multi-Role Sessions (Auth Flow)",
      item: [
        makeRequest(
          "AUTH-01: Manager Đăng nhập & Cấp phát Phiên làm việc",
          "POST",
          "/auth/login",
          [],
          { email: "{{managerEmail}}", password: "{{managerPassword}}" },
          makeHeader(false),
          `pm.test("Status code is 200 or 201 Success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Token JWT và thông tin Manager được cấp phát", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("accessToken");
    pm.expect(json.user.role).to.eql("MANAGER");
    pm.expect(json.user.status).to.eql("ACTIVE");
    pm.environment.set("accessToken", json.accessToken);
});`
        ),
        makeRequest(
          "AUTH-02: Trainer (Huấn luyện viên) Đăng nhập",
          "POST",
          "/auth/login",
          [],
          { email: "{{trainerEmail}}", password: "{{trainerPassword}}" },
          makeHeader(false),
          `pm.test("Status code is 200 or 201 Success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Token cấp cho đúng vai trò TRAINER", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("accessToken");
    pm.expect(json.user.role).to.eql("TRAINER");
    pm.environment.set("trainerToken", json.accessToken);
});`
        ),
        makeRequest(
          "AUTH-03: Groom (Nhân viên chăm sóc) Đăng nhập",
          "POST",
          "/auth/login",
          [],
          { email: "{{groomEmail}}", password: "{{groomPassword}}" },
          makeHeader(false),
          `pm.test("Status code is 200 or 201 Success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Token cấp cho đúng vai trò GROOM", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("accessToken");
    pm.expect(json.user.role).to.eql("GROOM");
    pm.environment.set("groomToken", json.accessToken);
});`
        ),
        makeRequest(
          "AUTH-04: Vet (Bác sĩ thú y) Đăng nhập",
          "POST",
          "/auth/login",
          [],
          { email: "{{vetEmail}}", password: "{{vetPassword}}" },
          makeHeader(false),
          `pm.test("Status code is 200 or 201 Success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Token cấp cho đúng vai trò VET", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("accessToken");
    pm.expect(json.user.role).to.eql("VET");
    pm.environment.set("vetToken", json.accessToken);
});`
        ),
        makeRequest(
          "AUTH-05: Kiểm tra Hồ sơ người dùng hiện tại (/auth/me)",
          "GET",
          "/auth/me",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[Business Rule] Thông tin định danh khớp chính xác tài khoản Manager", function () {
    const json = pm.response.json();
    pm.expect(json.email).to.eql(pm.environment.get("managerEmail"));
    pm.expect(json.role).to.eql("MANAGER");
});`
        )
      ]
    },

    // ==========================================
    // SUITE 02: QUẢN LÝ VÒNG ĐỜI NGỰA & ĐÁNH GIÁ THỂ LỰC (WORKFLOW 1)
    // ==========================================
    {
      name: "02. Quy trình Quản lý Vòng đời Ngựa & Đánh giá Thể lực",
      item: [
        makeRequest(
          "HORSE-01: [Nghiệp vụ] Manager Tạo hồ sơ Ngựa đua mới",
          "POST",
          "/horses",
          [],
          {
            name: "Chiến Mã Ánh Sáng",
            ownerId: "{{ownerId}}",
            gender: "MALE",
            breed: "Thoroughbred Thuần Chủng",
            stallNumber: "STALL-B01"
          },
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Ngựa mới có trạng thái ban đầu ACTIVE và chưa bị khóa tập luyện", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("id");
    pm.expect(json.name).to.eql("Chiến Mã Ánh Sáng");
    pm.expect(json.gender).to.eql("MALE");
    pm.expect(json.status).to.eql("ACTIVE");
    pm.expect(json.locked).to.be.false;
    pm.expect(json.healthStatus).to.eql("FIT");
    pm.expect(json.ownerId).to.eql(pm.environment.get("ownerId"));

    // Lưu ID ngựa mới để dùng xuyên suốt cho các bước nghiệp vụ sau
    pm.environment.set("createdHorseId", json.id);
});`
        ),
        makeRequest(
          "HORSE-02: [Nghiệp vụ] Cập nhật số chuồng và đặc điểm nhận dạng",
          "PATCH",
          "/horses/{{createdHorseId}}",
          [],
          {
            stallNumber: "STALL-VIP-09",
            saddleNumber: 28
          },
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[Business Rule] Thông tin vị trí chuồng trại được cập nhật chính xác", function () {
    const json = pm.response.json();
    pm.expect(json.stallNumber).to.eql("STALL-VIP-09");
    pm.expect(json.saddleNumber).to.eql(28);
});`
        ),
        makeRequest(
          "HORSE-03: [Nghiệp vụ - Quy tắc tính điểm] Bác sĩ thú y Đánh giá Thể lực 5 Tiêu chí",
          "POST",
          "/horses/{{createdHorseId}}/fitness-assessment",
          [],
          {
            speedScore: 18,
            staminaScore: 17,
            conditionScore: 19,
            recoveryScore: 16,
            moraleScore: 18,
            notes: "Thể lực xuất sắc, cơ bắp đàn hồi tốt, sẵn sàng cho giải đua"
          },
          makeHeader(true, "vetToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Calculation Rule] Tổng điểm totalScore bằng đúng tổng 5 tiêu chí thành phần", function () {
    const json = pm.response.json();
    const a = json.assessment;
    const expectedTotal = a.speedScore + a.staminaScore + a.conditionScore + a.recoveryScore + a.moraleScore;
    pm.expect(a.totalScore).to.eql(expectedTotal);
    pm.expect(a.totalScore).to.eql(88);
});
pm.test("[Business Rule] Điểm thể lực của ngựa được tự động đồng bộ sang hồ sơ chính", function () {
    const json = pm.response.json();
    pm.expect(json.horse.fitnessScore).to.eql(88);
    pm.expect(json.assessment.assessedBy.role).to.eql("VET");
});`
        ),
        makeRequest(
          "HORSE-04: [Nghiệp vụ Biên - Negative] Đánh giá điểm vượt quá thang đo cho phép (>20)",
          "POST",
          "/horses/{{createdHorseId}}/fitness-assessment",
          [],
          {
            speedScore: 25,
            staminaScore: 15,
            conditionScore: 15,
            recoveryScore: 15,
            moraleScore: 15
          },
          makeHeader(true, "vetToken"),
          `pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("[Business Rule] Server chặn điểm số vượt ngưỡng biên nghiệp vụ", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("VALIDATION_ERROR");
});`
        ),
        makeRequest(
          "HORSE-05: [Nghiệp vụ] Lấy danh sách lịch sử đánh giá thể lực",
          "GET",
          "/horses/{{createdHorseId}}/fitness-assessments",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[Business Rule] Lịch sử thể lực chứa bản ghi 88 điểm vừa đánh giá", function () {
    const json = pm.response.json();
    const list = Array.isArray(json) ? json : json.data;
    pm.expect(list.length).to.be.greaterThan(0);
    pm.expect(list[0].totalScore).to.eql(88);
});`
        ),
        makeRequest(
          "HORSE-06: [Nghiệp vụ - Khóa Huấn Luyện] Bác sĩ thú y Kích hoạt Training Lock vì lý do y tế",
          "PATCH",
          "/horses/{{createdHorseId}}/lock",
          [],
          {
            locked: true,
            reason: "Dấu hiệu căng cơ nhẹ sau đợt kiểm tra thể lực, cần nghỉ ngơi 3 ngày"
          },
          makeHeader(true, "vetToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[Business Rule] Trạng thái trainingLocked chuyển sang true kèm lý do cụ thể", function () {
    const json = pm.response.json();
    pm.expect(json.locked).to.be.true;
    pm.expect(json.lockReason).to.include("căng cơ nhẹ");
});`
        )
      ]
    },

    // ==========================================
    // SUITE 03: QUY TRÌNH LÊN LỊCH & THỰC HIỆN HUẤN LUYỆN (WORKFLOW 2)
    // ==========================================
    {
      name: "03. Quy trình Lên lịch & Thực hiện Huấn luyện (Training Flow)",
      item: [
        makeRequest(
          "TRAIN-01: [Nghiệp vụ An toàn - Negative] Huấn luyện viên cố tình tạo lịch tập cho Ngựa đang bị KHÓA",
          "POST",
          "/horses/{{createdHorseId}}/sessions",
          [],
          {
            scheduledAt: "2026-11-20T08:00:00.000Z",
            type: "GALLOP",
            distanceM: 1400,
            surface: "TURF",
            notes: "Bài tập chạy nước rút"
          },
          makeHeader(true, "trainerToken"),
          `pm.test("Status code is 400 or 409 Rejected", function () {
    pm.expect(pm.response.code).to.be.oneOf([400, 403, 409]);
});
pm.test("[Safety Business Rule] Hệ thống từ chối tạo lịch tập khi ngựa có lệnh cấm tập của bác sĩ", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
});`
        ),
        makeRequest(
          "TRAIN-02: [Nghiệp vụ] Huấn luyện viên Lên lịch buổi tập mới cho Ngựa khỏe mạnh",
          "POST",
          "/horses/{{existingHorseId}}/sessions",
          [],
          {
            scheduledAt: "{{trainingScheduledAt}}",
            type: "CANTER",
            distanceM: 1200,
            surface: "TURF",
            notes: "Bài tập rèn luyện nhịp thở và sức bền đường dài"
          },
          makeHeader(true, "trainerToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Buổi tập được khởi tạo ở trạng thái PLANNED kèm thông số cự ly", function () {
    const json = pm.response.json();
    pm.environment.set("createdSessionId", json.id);
    pm.expect(json).to.have.property("id");
    pm.expect(json.status).to.eql("PLANNED");
    pm.expect(json.type).to.eql("CANTER");
    pm.expect(json.distanceM).to.eql(1200);
    pm.expect(json.surface).to.eql("TURF");
    pm.expect(json.trainer.email).to.include("trainer");
});`,
          `// Tạo mốc thời gian huấn luyện tương lai động để tránh xung đột lịch tập (Conflict Rule)
const offset = 86400000 * 30 + Math.floor(Math.random() * 100000000);
pm.environment.set("trainingScheduledAt", new Date(Date.now() + offset).toISOString());`
        ),
        makeRequest(
          "TRAIN-03: [Nghiệp vụ Chuyển trạng thái] Huấn luyện viên Hoàn thành buổi tập & Ghi nhận kết quả",
          "PATCH",
          "/sessions/{{createdSessionId}}",
          [],
          {
            status: "DONE",
            resultMetric: "seconds",
            resultValue: 74.2,
            notes: "Ngựa hoàn thành bài tập tốt, thời gian đạt chuẩn thi đấu"
          },
          makeHeader(true, "trainerToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[State Transition Rule] Trạng thái chuyển từ PLANNED sang DONE và lưu trữ chỉ số thành tích", function () {
    const json = pm.response.json();
    pm.expect(json.status).to.eql("DONE");
    pm.expect(json.resultValue).to.eql(74.2);
    pm.expect(json.resultMetric).to.eql("seconds");
});`
        ),
        makeRequest(
          "TRAIN-04: [Nghiệp vụ] Dashboard Tổng quan Tiến độ Huấn luyện toàn chuồng",
          "GET",
          "/training/progress/overview",
          [],
          null,
          makeHeader(true, "trainerToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[Business Rule] Dashboard trả về dữ liệu tổng quan thống kê các buổi huấn luyện", function () {
    const json = pm.response.json();
    pm.expect(json).to.be.an("object");
});`
        )
      ]
    },

    // ==========================================
    // SUITE 04: CHĂM SÓC HÀNG NGÀY & KHẨU PHẦN ĂN (WORKFLOW 3)
    // ==========================================
    {
      name: "04. Quy trình Chăm sóc Hàng ngày & Dinh dưỡng (Daily Care & Feeding)",
      item: [
        makeRequest(
          "CARE-01: [Nghiệp vụ] Giao việc Chăm sóc Hàng ngày (Vệ sinh chuồng)",
          "POST",
          "/daily-care",
          [],
          {
            horseId: "{{existingHorseId}}",
            taskType: "CLEANING",
            notes: "Dọn dẹp chuồng, phun thuốc khử trùng và thay rơm lót mới"
          },
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Công việc mới tạo có trạng thái ban đầu completed = false", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("id");
    pm.expect(json.taskType).to.eql("CLEANING");
    pm.expect(json.completed).to.be.false;
    pm.expect(json.horseId).to.eql(pm.environment.get("existingHorseId"));

    pm.environment.set("createdCareId", json.id);
});`
        ),
        makeRequest(
          "CARE-02: [Nghiệp vụ Chuyển trạng thái] Nhân viên Groom Xác nhận Hoàn thành công việc",
          "PATCH",
          "/daily-care/{{createdCareId}}/toggle",
          [],
          null,
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[Business Rule] Trạng thái công việc chuyển đổi thành completed = true", function () {
    const json = pm.response.json();
    pm.expect(json.completed).to.be.true;
});`
        ),
        makeRequest(
          "CARE-03: [Nghiệp vụ Dinh dưỡng] Ghi nhận Nhật ký Cho ăn & Khẩu phần dinh dưỡng",
          "POST",
          "/horses/{{existingHorseId}}/feeding-records",
          [],
          {
            feedType: "Yến mạch & Cỏ khô Alfalfa",
            quantityKg: 6.5,
            date: "2026-11-01T07:00:00.000Z",
            notes: "Bổ sung khoáng vi lượng buổi sáng, ăn hết khẩu phần"
          },
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Nhật ký lưu đúng số kg và loại thức ăn cho đúng con ngựa", function () {
    const json = pm.response.json();
    pm.expect(json.quantityKg).to.eql(6.5);
    pm.expect(json.feedType).to.include("Yến mạch");
    pm.expect(json.recordedBy.email).to.include("groom");
});`
        ),
        makeRequest(
          "CARE-04: [Nghiệp vụ Biên - Negative] Ghi nhận khẩu phần dinh dưỡng với số lượng âm",
          "POST",
          "/horses/{{existingHorseId}}/feeding-records",
          [],
          {
            feedType: "Hay",
            quantityKg: -5,
            date: "2026-11-01T07:00:00.000Z"
          },
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("[Business Rule] Server từ chối khối lượng thức ăn âm hoặc bằng 0", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("VALIDATION_ERROR");
});`
        )
      ]
    },

    // ==========================================
    // SUITE 05: Y TẾ THÚ Y & TIÊM CHỦNG PHÒNG NGỪA (WORKFLOW 4)
    // ==========================================
    {
      name: "05. Quy trình Y tế Thú y & Tiêm chủng (Veterinary Flow)",
      item: [
        makeRequest(
          "VET-01: [Nghiệp vụ Bệnh án] Bác sĩ thú y Tạo Hồ sơ Khám bệnh",
          "POST",
          "/horses/{{existingHorseId}}/health-records",
          [],
          {
            examDate: "2026-11-01T08:00:00.000Z",
            diagnosis: "Khám định kỳ toàn diện, tim phổi và gân cơ bình thường",
            treatment: "Bổ sung vitamin tổng hợp và chất điện giải",
            healthStatus: "FIT"
          },
          makeHeader(true, "vetToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Bệnh án được lưu với kết luận sức khỏe FIT", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("id");
    pm.expect(json.healthStatus).to.eql("FIT");
    pm.expect(json.diagnosis).to.include("toàn diện");

    pm.environment.set("createdHealthRecordId", json.id);
});`
        ),
        makeRequest(
          "VET-02: [Nghiệp vụ Tiêm chủng] Bác sĩ thú y Lên Lịch Tiêm Vắc xin Phòng ngừa",
          "POST",
          "/horses/{{existingHorseId}}/vaccinations",
          [],
          {
            vaccineName: "Equine Influenza Booster (Cúm ngựa)",
            date: "2026-11-01T09:00:00.000Z",
            nextDueDate: "2027-05-01T09:00:00.000Z"
          },
          makeHeader(true, "vetToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Lịch tiêm phòng ghi nhận đúng loại vắc xin và ngày hẹn nhắc lại", function () {
    const json = pm.response.json();
    pm.expect(json.vaccineName).to.include("Equine Influenza");
    pm.expect(json.nextDueDate).to.eql("2027-05-01T09:00:00.000Z");
});`
        ),
        makeRequest(
          "VET-03: [Nghiệp vụ Ràng buộc - Negative] Tạo bệnh án nhưng ngày khám là tương lai",
          "POST",
          "/horses/{{existingHorseId}}/health-records",
          [],
          {
            examDate: "2028-01-01T08:00:00.000Z",
            diagnosis: "Khám trước tương lai"
          },
          makeHeader(true, "vetToken"),
          `pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("[Business Rule] Server từ chối ngày khám bệnh trong tương lai", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("VALIDATION_ERROR");
});`
        )
      ]
    },

    // ==========================================
    // SUITE 06: BÁO CÁO & XỬ LÝ SỰ CỐ KHẨN CẤP (WORKFLOW 5)
    // ==========================================
    {
      name: "06. Quy trình Báo cáo & Xử lý Sự cố Chuồng trại (Incident Flow)",
      item: [
        makeRequest(
          "INC-01: [Nghiệp vụ Báo cáo] Nhân viên Groom Lập Biên bản Sự cố khẩn cấp",
          "POST",
          "/horses/{{existingHorseId}}/incidents",
          [],
          {
            description: "Ngựa có biểu hiện biếng ăn và thân nhiệt hơi cao sau buổi tập chiều",
            severity: "MEDIUM"
          },
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Sự cố được ghi nhận ở trạng thái OPEN với mức độ MEDIUM", function () {
    const json = pm.response.json();
    pm.environment.set("createdIncidentId", json.id);
    pm.expect(json).to.have.property("id");
    pm.expect(json.status).to.eql("OPEN");
    pm.expect(json.severity).to.eql("MEDIUM");
    pm.expect(json.reportedBy.email).to.include("groom");
});`
        ),
        makeRequest(
          "INC-02: [Nghiệp vụ Chặt chẽ - Negative] Cố tình Đóng sự cố nhưng KHÔNG KÈM bệnh án của bác sĩ",
          "PATCH",
          "/incidents/{{createdIncidentId}}",
          [],
          {
            status: "RESOLVED"
          },
          makeHeader(true, "vetToken"),
          `pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("[Strict Business Rule] Bắt buộc phải có hồ sơ khám bệnh để đóng sự cố", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("VALIDATION_ERROR");
    pm.expect(json.error.message).to.include("hồ sơ khám");
});`
        ),
        makeRequest(
          "INC-03: [Nghiệp vụ Đóng sự cố] Bác sĩ thú y Đóng sự cố kèm Hồ sơ Y tế Chứng thực",
          "PATCH",
          "/incidents/{{createdIncidentId}}",
          [],
          `{
            "status": "RESOLVED",
            "healthRecordId": "{{createdHealthRecordId}}"
          }`,
          makeHeader(true, "vetToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[Business Rule] Sự cố được giải quyết thành công (RESOLVED) gắn liền hồ sơ y bạ", function () {
    const json = pm.response.json();
    pm.expect(json.status).to.eql("RESOLVED");
    pm.expect(json.healthRecordId).to.eql(pm.environment.get("createdHealthRecordId"));
});`
        )
      ]
    },

    // ==========================================
    // SUITE 07: TỔ CHỨC GIẢI ĐUA & ĐĂNG KÝ THI ĐẤU (WORKFLOW 6)
    // ==========================================
    {
      name: "07. Quy trình Tổ chức Giải đua & Đăng ký Thi đấu (Racing Flow)",
      item: [
        makeRequest(
          "RACE-01: [Nghiệp vụ] Manager Khởi tạo Giải Đua Mới",
          "POST",
          "/races",
          [],
          {
            name: "Giải Đua Ngựa Mùa Thu Cúp Vô Địch 2026",
            date: "2026-12-15T14:00:00.000Z",
            venue: "Trường Đua Quốc Tế Bình Dương",
            distance: 1600,
            surface: "TURF",
            prizePool: 50000000
          },
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Giải đua được tạo với đầy đủ thông số cự ly, địa điểm, giải thưởng", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("id");
    pm.expect(json.name).to.include("Mùa Thu");
    pm.expect(json.distance).to.eql(1600);
    pm.expect(json.prizePool).to.eql(50000000);

    pm.environment.set("createdRaceId", json.id);
});`
        ),
        makeRequest(
          "RACE-02: [Nghiệp vụ] Đăng ký Ngựa vào Danh sách Thi đấu của Giải",
          "POST",
          "/races/{{createdRaceId}}/entries",
          [],
          {
            horseId: "{{existingHorseId}}",
            position: 1,
            time: "1:38.45"
          },
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 201 Created", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("[Business Rule] Ngựa được ghi danh thành công vào giải đấu", function () {
    const json = pm.response.json();
    pm.expect(json.raceId).to.eql(pm.environment.get("createdRaceId"));
    pm.expect(json.horseId).to.eql(pm.environment.get("existingHorseId"));
    pm.expect(json.horse.name).to.eql("Thunderbolt");
});`
        )
      ]
    },

    // ==========================================
    // SUITE 08: KIỂM THỬ PHÂN QUYỀN RBAC & BẢO MẬT (SECURITY RBAC)
    // ==========================================
    {
      name: "08. Kiểm thử An ninh & Phân quyền Vai trò (RBAC Enforcement)",
      item: [
        makeRequest(
          "RBAC-01: [Phân quyền Hợp lệ] Manager truy cập danh sách quản trị người dùng",
          "GET",
          "/users",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("[RBAC Rule] Quản lý (Manager) có toàn quyền truy xuất danh sách nhân viên", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("data");
    pm.expect(Array.isArray(json.data)).to.be.true;
});`
        ),
        makeRequest(
          "RBAC-02: [Vượt quyền Trái phép - Negative] Groom cố tình gọi API Quản trị Người dùng",
          "GET",
          "/users",
          [],
          null,
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 403 Forbidden", function () {
    pm.response.to.have.status(403);
});
pm.test("[RBAC Rule] Hệ thống từ chối nhân viên Groom truy cập khu vực của Manager", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("FORBIDDEN");
});`
        ),
        makeRequest(
          "RBAC-03: [Không có Token - Negative] Gọi API bảo mật không có Authorization Header",
          "GET",
          "/users",
          [],
          null,
          makeHeader(false),
          `pm.test("Status code is 401 Unauthorized", function () {
    pm.response.to.have.status(401);
});
pm.test("[Security Rule] Chặn truy cập khi thiếu Bearer Token", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("UNAUTHENTICATED");
});`
        ),
        makeRequest(
          "RBAC-04: [Vượt quyền Trái phép - Negative] Groom cố tình Tạo Ngựa mới",
          "POST",
          "/horses",
          [],
          {
            name: "Ngựa Trái Phép",
            ownerId: "{{ownerId}}",
            gender: "MALE"
          },
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 403 Forbidden", function () {
    pm.response.to.have.status(403);
});
pm.test("[RBAC Rule] Chỉ duy nhất Manager mới có thẩm quyền tạo hồ sơ ngựa", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("FORBIDDEN");
});`
        )
      ]
    }
  ]
};

// Write files
const postmanDir = path.resolve(__dirname);
const collPath = path.join(postmanDir, 'Racehorse_System_API_Testing.postman_collection.json');
const envPath = path.join(postmanDir, 'Racehorse_Local.postman_environment.json');

fs.writeFileSync(collPath, JSON.stringify(collection, null, 2), 'utf8');
fs.writeFileSync(envPath, JSON.stringify(environment, null, 2), 'utf8');

console.log("Successfully generated Business Logic API Testing Suite:");
console.log("- Collection: " + collPath);
console.log("- Environment: " + envPath);
