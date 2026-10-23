import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app";
import { ConduitDatabase } from "../src/database";

const secret = "local-test-secret-that-is-at-least-thirty-two-characters";
const databases: ConduitDatabase[] = [];

function client() {
  const db = new ConduitDatabase(":memory:");
  databases.push(db);
  return request(createApp(db, secret));
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

async function register(api: ReturnType<typeof client>, username: string) {
  const response = await api.post("/api/users").send({
    user: { username, email: `${username}@example.test`, password: "password123" }
  });
  assert.equal(response.status, 201);
  return { token: response.body.user.token as string, user: response.body.user };
}

test("registration, authentication, profile updates, and validation errors", async () => {
  const api = client();
  const invalid = await api.post("/api/users").send({
    user: { username: "", email: "bad@example.test", password: "password123" }
  });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.errors.username[0], "can't be blank");

  const { token, user } = await register(api, "reader");
  assert.equal(user.bio, null);
  assert.equal((await api.get("/api/user")).status, 401);
  const current = await api.get("/api/user").set("Authorization", `Token ${token}`);
  assert.equal(current.status, 200);
  assert.equal(current.body.user.username, "reader");

  const updated = await api.put("/api/user")
    .set("Authorization", `Token ${token}`)
    .send({ user: { bio: "Author bio", image: "" } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.bio, "Author bio");
  assert.equal(updated.body.user.image, null);
  assert.equal((await api.post("/api/users").send({
    user: { username: "reader", email: "other@example.test", password: "password123" }
  })).status, 409);
  assert.equal((await api.post("/api/users/login").send({
    user: { email: "reader@example.test", password: "wrongpassword" }
  })).status, 401);
});

test("article CRUD, filters, favorites, comments, and ownership", async () => {
  const api = client();
  const author = await register(api, "author");
  const follower = await register(api, "follower");

  const created = await api.post("/api/articles")
    .set("Authorization", `Token ${author.token}`)
    .send({ article: { title: "A Real Article", description: "Intro", body: "Full text", tagList: ["testing", "api"] } });
  assert.equal(created.status, 201);
  const slug = created.body.article.slug as string;
  assert.deepEqual(created.body.article.tagList, ["testing", "api"]);

  const list = await api.get("/api/articles?tag=testing&author=author");
  assert.equal(list.body.articlesCount, 1);
  assert.equal("body" in list.body.articles[0], false);

  const followed = await api.post("/api/profiles/author/follow").set("Authorization", `Token ${follower.token}`);
  assert.equal(followed.body.profile.following, true);
  assert.equal((await api.get("/api/articles/feed").set("Authorization", `Token ${follower.token}`)).body.articlesCount, 1);

  const favorited = await api.post(`/api/articles/${slug}/favorite`).set("Authorization", `Token ${follower.token}`);
  assert.equal(favorited.body.article.favoritesCount, 1);
  assert.equal(favorited.body.article.favorited, true);
  assert.equal((await api.get("/api/articles?favorited=follower")).body.articlesCount, 1);

  const comment = await api.post(`/api/articles/${slug}/comments`)
    .set("Authorization", `Token ${follower.token}`)
    .send({ comment: { body: "Useful article" } });
  assert.equal(comment.status, 201);
  const commentId = comment.body.comment.id as number;
  assert.equal((await api.get(`/api/articles/${slug}/comments`)).body.comments.length, 1);
  assert.equal((await api.delete(`/api/articles/${slug}/comments/${commentId}`)
    .set("Authorization", `Token ${author.token}`)).status, 403);

  assert.equal((await api.put(`/api/articles/${slug}`)
    .set("Authorization", `Token ${follower.token}`)
    .send({ article: { body: "Unauthorized edit" } })).status, 403);
  const renamed = await api.put(`/api/articles/${slug}`)
    .set("Authorization", `Token ${author.token}`)
    .send({ article: { title: "A Different Title" } });
  assert.equal(renamed.status, 200);
  assert.notEqual(renamed.body.article.slug, slug);
  assert.deepEqual(renamed.body.article.tagList, ["testing", "api"]);
  assert.equal((await api.get("/api/tags")).body.tags.includes("testing"), true);

  assert.equal((await api.delete(`/api/articles/${renamed.body.article.slug}`)
    .set("Authorization", `Token ${author.token}`)).status, 204);
  assert.equal((await api.get(`/api/articles/${renamed.body.article.slug}`)).status, 404);
});

test("slugs remain unique and empty tag updates remove tags", async () => {
  const api = client();
  const { token } = await register(api, "slugger");
  const create = () => api.post("/api/articles")
    .set("Authorization", `Token ${token}`)
    .send({ article: { title: "Same Title", description: "Description", body: "Body", tagList: ["keep"] } });
  const first = await create();
  const second = await create();
  assert.notEqual(first.body.article.slug, second.body.article.slug);

  const changed = await api.put(`/api/articles/${first.body.article.slug}`)
    .set("Authorization", `Token ${token}`)
    .send({ article: { tagList: [] } });
  assert.deepEqual(changed.body.article.tagList, []);
  assert.equal((await api.get("/api/articles?limit=1&offset=1")).body.articlesCount, 2);
  assert.equal((await api.get("/api/articles?limit=-1")).status, 422);
});
