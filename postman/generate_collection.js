const fs = require('fs');
const path = require('path');

// 1. Postman Environment
const environment = {
  id: "e1b2c3d4-race-horse-local-env",
  name: "Racehorse System - Local Environment",
  values: [
    {
      key: "baseUrl",
      value: "http://localhost:3000/api/v1",
      type: "default",
      enabled: true
    },
    {
      key: "managerEmail",
      value: "manager@racehorse.local",
      type: "default",
      enabled: true
    },
    {
      key: "managerPassword",
      value: "Manager123!",
      type: "default",
      enabled: true
    },
    {
      key: "trainerEmail",
      value: "trainer@racehorse.local",
      type: "default",
      enabled: true
    },
    {
      key: "trainerPassword",
      value: "Trainer123!",
      type: "default",
      enabled: true
    },
    {
      key: "groomEmail",
      value: "groom@racehorse.local",
      type: "default",
      enabled: true
    },
    {
      key: "groomPassword",
      value: "Groom123!",
      type: "default",
      enabled: true
    },
    {
      key: "ownerEmail",
      value: "owner1@racehorse.local",
      type: "default",
      enabled: true
    },
    {
      key: "ownerPassword",
      value: "Owner123!",
      type: "default",
      enabled: true
    },
    {
      key: "existingHorseId",
      value: "29a1cab8-79fb-4e19-a82c-1e67a87fe2d0",
      type: "default",
      enabled: true
    },
    {
      key: "invalidUUID",
      value: "not-a-valid-uuid-12345",
      type: "default",
      enabled: true
    },
    {
      key: "nonExistingUUID",
      value: "00000000-0000-0000-0000-000000000000",
      type: "default",
      enabled: true
    },
    {
      key: "accessToken",
      value: "",
      type: "secret",
      enabled: true
    },
    {
      key: "trainerToken",
      value: "",
      type: "secret",
      enabled: true
    },
    {
      key: "groomToken",
      value: "",
      type: "secret",
      enabled: true
    },
    {
      key: "ownerToken",
      value: "",
      type: "secret",
      enabled: true
    },
    {
      key: "managerUserId",
      value: "",
      type: "default",
      enabled: true
    }
  ],
  _postman_variable_scope: "environment"
};

// 2. Helper functions to build requests
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

function makeRequest(name, method, urlPath, query = [], body = null, headers = [], testScript = "") {
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
      raw: JSON.stringify(body, null, 2),
      options: {
        raw: {
          language: "json"
        }
      }
    };
  }

  if (testScript) {
    item.event = [
      {
        listen: "test",
        script: {
          exec: testScript.trim().split("\n"),
          type: "text/javascript"
        }
      }
    ];
  }

  return item;
}

// 3. Define Test Suites
const collection = {
  info: {
    _postman_id: "7a8b9c0d-race-horse-api-testing",
    name: "Racehorse Management System — API Testing Suite",
    description: "Bộ kiểm thử API tự động hoàn chỉnh cho môn Software Testing (SWP391 / SWTEST).\nBao gồm đầy đủ các loại kiểm thử: Smoke Test, Positive/Happy Path, Negative/Validation, RBAC Authorization, và Error Handling.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    // --- 00. Health & Smoke Test ---
    {
      name: "00. Smoke & Sanity Testing",
      item: [
        makeRequest(
          "TC-01: [Smoke] Server Health Check",
          "GET",
          "/health",
          [],
          null,
          makeHeader(false),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Response time is under 1500ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(1500);
});
pm.test("Database connection is UP", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("status", "ok");
    pm.expect(json).to.have.property("db", "up");
    pm.expect(json).to.have.property("time");
});`
        )
      ]
    },

    // --- 01. Authentication & Session ---
    {
      name: "01. Authentication & Authorization",
      item: [
        makeRequest(
          "TC-02: [Positive] Manager Login (Store AccessToken)",
          "POST",
          "/auth/login",
          [],
          { email: "{{managerEmail}}", password: "{{managerPassword}}" },
          makeHeader(false),
          `pm.test("Status code is 200 or 201 Success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("Response body contains JWT tokens and user info", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("accessToken");
    pm.expect(json).to.have.property("refreshToken");
    pm.expect(json).to.have.property("user");
    pm.expect(json.user.role).to.eql("MANAGER");
    
    // Lưu token vào Environment cho các request tiếp theo
    pm.environment.set("accessToken", json.accessToken);
    pm.environment.set("managerUserId", json.user.id);
});`
        ),
        makeRequest(
          "TC-03: [Positive] Trainer Login (Store TrainerToken)",
          "POST",
          "/auth/login",
          [],
          { email: "{{trainerEmail}}", password: "{{trainerPassword}}" },
          makeHeader(false),
          `pm.test("Status code is 200 or 201 Success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("Response returns Trainer role and tokens", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("accessToken");
    pm.expect(json.user.role).to.eql("TRAINER");
    pm.environment.set("trainerToken", json.accessToken);
});`
        ),
        makeRequest(
          "TC-04: [Positive] Groom Login (Store GroomToken)",
          "POST",
          "/auth/login",
          [],
          { email: "{{groomEmail}}", password: "{{groomPassword}}" },
          makeHeader(false),
          `pm.test("Status code is 200 or 201 Success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("Response returns Groom role and tokens", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("accessToken");
    pm.expect(json.user.role).to.eql("GROOM");
    pm.environment.set("groomToken", json.accessToken);
});`
        ),
        makeRequest(
          "TC-05: [Positive] Owner Login (Store OwnerToken)",
          "POST",
          "/auth/login",
          [],
          { email: "{{ownerEmail}}", password: "{{ownerPassword}}" },
          makeHeader(false),
          `pm.test("Status code is 200 or 201 Success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});
pm.test("Response returns Owner role and tokens", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("accessToken");
    pm.expect(json.user.role).to.eql("OWNER");
    pm.environment.set("ownerToken", json.accessToken);
});`
        ),
        makeRequest(
          "TC-06: [Positive] Get Current Profile (/auth/me)",
          "GET",
          "/auth/me",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Profile matches authenticated user", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("id");
    pm.expect(json).to.have.property("email", pm.environment.get("managerEmail"));
    pm.expect(json).to.have.property("role", "MANAGER");
});`
        ),
        makeRequest(
          "TC-07: [Negative] Login with Invalid Password",
          "POST",
          "/auth/login",
          [],
          { email: "{{managerEmail}}", password: "WrongPassword!999" },
          makeHeader(false),
          `pm.test("Status code is 401 Unauthorized", function () {
    pm.response.to.have.status(401);
});
pm.test("Error code is INVALID_CREDENTIALS", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("INVALID_CREDENTIALS");
});`
        ),
        makeRequest(
          "TC-08: [Negative] Login with Missing Fields",
          "POST",
          "/auth/login",
          [],
          { email: "{{managerEmail}}" },
          makeHeader(false),
          `pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Error code is VALIDATION_ERROR", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("VALIDATION_ERROR");
});`
        ),
        makeRequest(
          "TC-09: [Negative] Register with Duplicate Email",
          "POST",
          "/auth/register",
          [],
          { name: "Duplicate User", email: "{{managerEmail}}", password: "NewPassword123!" },
          makeHeader(false),
          `pm.test("Status code is 409 Conflict", function () {
    pm.response.to.have.status(409);
});
pm.test("Error code is CONFLICT", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("CONFLICT");
});`
        ),
        makeRequest(
          "TC-10: [Negative] Register with Invalid Email Format",
          "POST",
          "/auth/register",
          [],
          { name: "Test User", email: "not-an-email-format", password: "ValidPassword123!" },
          makeHeader(false),
          `pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Error code is VALIDATION_ERROR", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("VALIDATION_ERROR");
});`
        )
      ]
    },

    // --- 02. RBAC & Security Testing ---
    {
      name: "02. RBAC & Access Control Testing",
      item: [
        makeRequest(
          "TC-11: [RBAC - Positive] Manager Accesses Users List",
          "GET",
          "/users",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK for Manager", function () {
    pm.response.to.have.status(200);
});
pm.test("Returns user records array", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("data");
    pm.expect(Array.isArray(json.data)).to.be.true;
});`
        ),
        makeRequest(
          "TC-12: [RBAC - Negative] Groom Accesses Manager-only Users Endpoint",
          "GET",
          "/users",
          [],
          null,
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 403 Forbidden for Groom", function () {
    pm.response.to.have.status(403);
});
pm.test("Error code is FORBIDDEN", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("FORBIDDEN");
});`
        ),
        makeRequest(
          "TC-13: [RBAC - Negative] Trainer Accesses Manager-only Users Endpoint",
          "GET",
          "/users",
          [],
          null,
          makeHeader(true, "trainerToken"),
          `pm.test("Status code is 403 Forbidden for Trainer", function () {
    pm.response.to.have.status(403);
});
pm.test("Error code is FORBIDDEN", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("FORBIDDEN");
});`
        ),
        makeRequest(
          "TC-14: [Security - Negative] Request Without Authorization Header",
          "GET",
          "/users",
          [],
          null,
          makeHeader(false),
          `pm.test("Status code is 401 Unauthorized", function () {
    pm.response.to.have.status(401);
});
pm.test("Error code is UNAUTHENTICATED", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("UNAUTHENTICATED");
});`
        ),
        makeRequest(
          "TC-15: [Security - Negative] Request With Malformed/Invalid Token",
          "GET",
          "/users",
          [],
          null,
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer this-is-a-fake-token-string" }
          ],
          `pm.test("Status code is 401 Unauthorized", function () {
    pm.response.to.have.status(401);
});
pm.test("Error code is TOKEN_INVALID", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("TOKEN_INVALID");
});`
        )
      ]
    },

    // --- 03. Horses Management ---
    {
      name: "03. Horses Management API",
      item: [
        makeRequest(
          "TC-16: [Positive] Get List of Horses",
          "GET",
          "/horses",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Response has pagination and horse list", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("data");
    pm.expect(json).to.have.property("total");
    pm.expect(Array.isArray(json.data)).to.be.true;
    pm.expect(json.data.length).to.be.greaterThan(0);
});`
        ),
        makeRequest(
          "TC-17: [Positive] Filter Horses by Status & Limit",
          "GET",
          "/horses",
          [
            { key: "status", value: "ACTIVE" },
            { key: "limit", value: "5" }
          ],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Filtered results have correct status", function () {
    const json = pm.response.json();
    pm.expect(json.data.length).to.be.at.most(5);
    json.data.forEach(h => {
        pm.expect(h.status).to.eql("ACTIVE");
    });
});`
        ),
        makeRequest(
          "TC-18: [Positive] Get Stalls Map",
          "GET",
          "/horses/stalls/map",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});`
        ),
        makeRequest(
          "TC-19: [Positive] Get Single Horse By ID",
          "GET",
          "/horses/{{existingHorseId}}",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Returned horse matches requested ID", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("id", pm.environment.get("existingHorseId"));
    pm.expect(json).to.have.property("name");
    pm.expect(json).to.have.property("status");
});`
        ),
        makeRequest(
          "TC-20: [Positive] Get Horse Pedigree Tree",
          "GET",
          "/horses/{{existingHorseId}}/pedigree",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});`
        ),
        makeRequest(
          "TC-21: [Positive] Get Horse Fitness Assessments",
          "GET",
          "/horses/{{existingHorseId}}/fitness-assessments",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});`
        ),
        makeRequest(
          "TC-22: [Negative] Get Horse with Invalid UUID Format",
          "GET",
          "/horses/{{invalidUUID}}",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Error code is VALIDATION_ERROR", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("VALIDATION_ERROR");
});`
        ),
        makeRequest(
          "TC-23: [Negative] Get Horse with Non-existing UUID",
          "GET",
          "/horses/{{nonExistingUUID}}",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 404 Not Found", function () {
    pm.response.to.have.status(404);
});
pm.test("Error code is NOT_FOUND", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("error");
    pm.expect(json.error.code).to.eql("NOT_FOUND");
});`
        ),
        makeRequest(
          "TC-24: [RBAC - Negative] Groom Attempts to Create Horse",
          "POST",
          "/horses",
          [],
          {
            name: "Forbidden Stallion",
            dateOfBirth: "2023-01-01T00:00:00.000Z",
            gender: "STALLION",
            breed: "Thoroughbred"
          },
          makeHeader(true, "groomToken"),
          `pm.test("Status code is 403 Forbidden", function () {
    pm.response.to.have.status(403);
});
pm.test("Error code is FORBIDDEN", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("FORBIDDEN");
});`
        )
      ]
    },

    // --- 04. Daily Care & Feeding ---
    {
      name: "04. Daily Care & Feeding API",
      item: [
        makeRequest(
          "TC-25: [Positive] List Daily Care Tasks",
          "GET",
          "/daily-care",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Daily care list is returned", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("data");
    pm.expect(Array.isArray(json.data)).to.be.true;
});`
        ),
        makeRequest(
          "TC-26: [Positive] List Feeding Records for Horse",
          "GET",
          "/horses/{{existingHorseId}}/feeding-records",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Feeding records list is returned", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("data");
    pm.expect(Array.isArray(json.data)).to.be.true;
});`
        ),
        makeRequest(
          "TC-27: [Negative] Create Daily Care with Empty Body",
          "POST",
          "/daily-care",
          [],
          {},
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Error code is VALIDATION_ERROR", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("VALIDATION_ERROR");
});`
        )
      ]
    },

    // --- 05. Health, Vaccinations & Injuries ---
    {
      name: "05. Health & Medical Records API",
      item: [
        makeRequest(
          "TC-28: [Positive] List Health Records for Horse",
          "GET",
          "/horses/{{existingHorseId}}/health-records",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Health records list is returned", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("data");
    pm.expect(Array.isArray(json.data)).to.be.true;
});`
        ),
        makeRequest(
          "TC-29: [Positive] List Vaccinations for Horse",
          "GET",
          "/horses/{{existingHorseId}}/vaccinations",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Vaccinations list is returned", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("data");
    pm.expect(Array.isArray(json.data)).to.be.true;
});`
        ),
        makeRequest(
          "TC-30: [Positive] List Injuries for Horse",
          "GET",
          "/horses/{{existingHorseId}}/injuries",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});`
        )
      ]
    },

    // --- 06. Training, Races & Incidents ---
    {
      name: "06. Training, Races & Incidents API",
      item: [
        makeRequest(
          "TC-31: [Positive] Training Progress Overview",
          "GET",
          "/training/progress/overview",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});`
        ),
        makeRequest(
          "TC-32: [Positive] List Races",
          "GET",
          "/races",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Races list is returned", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("data");
    pm.expect(Array.isArray(json.data)).to.be.true;
});`
        ),
        makeRequest(
          "TC-33: [Positive] List Incidents",
          "GET",
          "/incidents",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});`
        )
      ]
    },

    // --- 07. User Management ---
    {
      name: "07. User Management API",
      item: [
        makeRequest(
          "TC-34: [Positive] Manager Gets Single User Detail",
          "GET",
          "/users/{{managerUserId}}",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("User data has expected properties", function () {
    const json = pm.response.json();
    pm.expect(json).to.have.property("id", pm.environment.get("managerUserId"));
    pm.expect(json).to.have.property("email");
    pm.expect(json).to.have.property("role");
});`
        ),
        makeRequest(
          "TC-35: [Negative] Get User with Non-existing ID",
          "GET",
          "/users/{{nonExistingUUID}}",
          [],
          null,
          makeHeader(true, "accessToken"),
          `pm.test("Status code is 404 Not Found", function () {
    pm.response.to.have.status(404);
});
pm.test("Error code is NOT_FOUND", function () {
    const json = pm.response.json();
    pm.expect(json.error.code).to.eql("NOT_FOUND");
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

console.log("Successfully generated:");
console.log("- Collection: " + collPath);
console.log("- Environment: " + envPath);
