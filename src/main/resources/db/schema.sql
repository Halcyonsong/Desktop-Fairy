create table if not exists chat_session (
                                            id integer primary key autoincrement,
                                            session_id text not null unique,
                                            title text not null,
                                            create_time text not null,
                                            update_time text not null
);

create index if not exists idx_chat_session_update_time
    on chat_session(update_time desc);

create table if not exists chat_history (
                                            id integer primary key autoincrement,
                                            session_id text not null,
                                            role text not null,
                                            content text not null,
                                            status text not null,
                                            create_time text not null
);

create index if not exists idx_chat_history_session_id_id
    on chat_history(session_id, id);

create table if not exists chat_summary (
                                            id integer primary key autoincrement,
                                            session_id text not null,
                                            content text not null,
                                            start_index integer not null,
                                            end_index integer not null,
                                            message_count integer not null,
                                            create_time text not null
);

create index if not exists idx_chat_summary_session_id_id
    on chat_summary(session_id, id);

create table if not exists chat_summary_cursor (
                                            id integer primary key autoincrement,
                                            session_id text not null unique,
                                            compressed_cursor integer not null
);

create table if not exists model_source (
                                            id integer primary key autoincrement,
                                            source_code text not null unique,
                                            name text not null,
                                            provider text not null,
                                            base_url text not null,
                                            api_key text not null,
                                            create_time text not null,
                                            update_time text not null
);

create index if not exists idx_model_source_provider
    on model_source(provider);

create table if not exists model_source_model (
                                                  id integer primary key autoincrement,
                                                  source_id integer not null,
                                                  model_name text not null,
                                                  create_time text not null,
                                                  update_time text not null,
                                                  unique(source_id, model_name)
    );

create index if not exists idx_model_source_model_source_id
    on model_source_model(source_id);

CREATE TABLE IF NOT EXISTS session_file_reference (
                                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                      file_reference_id TEXT NOT NULL,
                                                      session_id TEXT NOT NULL,
                                                      absolute_path TEXT NOT NULL,
                                                      original_file_name TEXT NOT NULL,
                                                      content_type TEXT,
                                                      file_size INTEGER,
                                                      last_known_modified_time TEXT,
                                                      status TEXT NOT NULL,
                                                      create_time TEXT NOT NULL,
                                                      update_time TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_session_file_reference_file_reference_id
    ON session_file_reference (file_reference_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_session_file_reference_session_path
    ON session_file_reference (session_id, absolute_path);

CREATE INDEX IF NOT EXISTS idx_session_file_reference_session_id
    ON session_file_reference (session_id);

create table if not exists session_folder_reference (
                                                        id integer primary key autoincrement,
                                                        folder_reference_id text not null,
                                                        session_id text not null,
                                                        absolute_path text not null,
                                                        folder_name text not null,
                                                        status text not null,
                                                        create_time text not null,
                                                        update_time text not null
);

create unique index if not exists uk_session_folder_reference_folder_reference_id
    on session_folder_reference(folder_reference_id);

create unique index if not exists uk_session_folder_reference_session_path
    on session_folder_reference(session_id, absolute_path);

create index if not exists idx_session_folder_reference_session_id
    on session_folder_reference(session_id);