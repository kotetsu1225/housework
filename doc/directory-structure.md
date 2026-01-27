# ディレクトリ構成

以下は主要な構成。生成物・依存物（`backend/build/`, `frontend/dist/`, `frontend/node_modules/` など）は記載対象外。

```
.
├── CLAUDE.md
├── README.md
├── docker-compose.yml
├── 要件定義.md
├── doc/
│   ├── backend-issues.md
│   ├── backend-todo.md
│   ├── project-configuration-summary.md
│   ├── web-app-features-todo.md
│   ├── domain-model.md
│   ├── sequence-diagram.md
│   ├── er-diagram.md
│   └── directory-structure.md
├── backend/
│   ├── docker/
│   │   └── postgres/
│   │       └── init.sql
│   ├── db/
│   │   └── migration/
│   ├── gradle/
│   │   └── wrapper/
│   └── src/
│       ├── generated/
│       │   └── jooq/
│       ├── main/
│       │   ├── kotlin/
│       │   │   └── com/task/
│       │   │       ├── domain/
│       │   │       ├── infra/
│       │   │       ├── presentation/
│       │   │       ├── scheduler/
│       │   │       └── usecase/
│       │   └── resources/
│       └── test/
│           └── kotlin/
└── frontend/
    ├── public/
    │   └── familyIcons/
    └── src/
        ├── api/
        ├── components/
        │   ├── auth/
        │   ├── dashboard/
        │   ├── layout/
        │   └── ui/
        ├── constants/
        ├── contexts/
        ├── hooks/
        ├── mocks/
        ├── pages/
        │   └── __tests__/
        ├── test/
        ├── types/
        └── utils/
```
