---
title: "Flow Matching Library"
collection: portfolio
category: Research Projects
date: 2025-06-01
header:
  teaser: "/images/portfolio/flow_matching_teaser.gif"
excerpt: "A PyTorch Lightning library for Flow Matching with classifier-free guidance."
paperurl: "https://arxiv.org/pdf/2412.06264"
---

* __Ressources__: [GitHub](https://github.com/mathis-wauquiez/FlowMatchingLibrary)
* __When__: 2025
* __Associated to__: My Internship

<img src='/images/portfolio/flow_matching.png'>


This is a library I have developped during my internship at Télécom Paris, under the supervision of Yann Gousseau, Alasdair Newson and Andrés Almansa. It implements everything needed to do basic Flow Matching, and is based on the equations in the paper "Flow Matching Guide and Code" [arxiv][https://arxiv.org/pdf/2412.06264] by Meta. To be more precise, it implements:
- Basic FM using specified schedulers and an affine path
- Classifier-Guided FM
- Classifier-free guidance


It is built using pytorch-lightning and hydra, enabling the user to train models on multiple GPUs and giving access to extensive features.


Here are the examples notebooks for this library:

<div style="border: 2px solid #ccc; border-radius: 12px; padding: 1rem; font-family: sans-serif; background: #f9f9f9; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; font-size: 1.4rem; color: #333;">Notebook: <em>test_module.ipynb</em></h2>

  <div style="position: relative; width: 100%; padding-top: 56.25%; overflow: hidden; border-radius: 8px; margin-top: 1rem;">
    <iframe
      src="/files/portfolio/flow_matching/test_module.html"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
      allowfullscreen
    ></iframe>
  </div>
</div>


<div style="border: 2px solid #ccc; border-radius: 12px; padding: 1rem; font-family: sans-serif; background: #f9f9f9; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; font-size: 1.4rem; color: #333;">Notebook: <em>train_module.ipynb</em></h2>

  <div style="position: relative; width: 100%; padding-top: 56.25%; overflow: hidden; border-radius: 8px; margin-top: 1rem;">
    <iframe
      src="/files/portfolio/flow_matching/train_model.html"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
      allowfullscreen
    ></iframe>
  </div>
</div>
