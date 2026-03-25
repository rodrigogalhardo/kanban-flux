import { Octokit } from "octokit";

const ORG_NAME = "kanban-flux";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN environment variable is required");
  return new Octokit({ auth: token });
}

export async function createRepository(name: string, description?: string) {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.createInOrg({
    org: ORG_NAME,
    name,
    description: description || "",
    private: false,
    auto_init: true,
  });
  return {
    fullName: data.full_name,
    url: data.html_url,
    cloneUrl: data.clone_url,
    sshUrl: data.ssh_url,
  };
}

export async function createBranch(repo: string, branchName: string, fromBranch: string = "main") {
  const octokit = getOctokit();
  const { data: ref } = await octokit.rest.git.getRef({
    owner: ORG_NAME,
    repo,
    ref: `heads/${fromBranch}`,
  });
  await octokit.rest.git.createRef({
    owner: ORG_NAME,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  });
  return branchName;
}

export async function commitFile(repo: string, path: string, content: string, message: string, branch: string = "main") {
  const octokit = getOctokit();

  // Check if file exists
  let sha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: ORG_NAME,
      repo,
      path,
      ref: branch,
    });
    if (!Array.isArray(data)) sha = data.sha;
  } catch {
    // File doesn't exist, that's fine
  }

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner: ORG_NAME,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    branch,
    sha,
  });
  return data.commit;
}

export async function createPullRequest(repo: string, title: string, body: string, head: string, base: string = "main") {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.create({
    owner: ORG_NAME,
    repo,
    title,
    body,
    head,
    base,
  });
  return {
    number: data.number,
    url: data.html_url,
    state: data.state,
  };
}

export async function mergePullRequest(repo: string, pullNumber: number) {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.merge({
    owner: ORG_NAME,
    repo,
    pull_number: pullNumber,
  });
  return data;
}

export async function listRepos() {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.listForOrg({
    org: ORG_NAME,
    sort: "updated",
    per_page: 100,
  });
  return data.map(r => ({
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    description: r.description,
    updatedAt: r.updated_at,
  }));
}
