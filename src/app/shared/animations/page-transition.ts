import { Animation, AnimationController } from '@ionic/angular/standalone';

const ctrl = new AnimationController();

export function gatemateNavAnimation(_baseEl: HTMLElement, opts: { enteringEl: HTMLElement; leavingEl?: HTMLElement; direction?: string }): Animation {
  const back = opts.direction === 'back';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduce ? 1 : 320;
  const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const entering = ctrl
    .create()
    .addElement(opts.enteringEl)
    .beforeRemoveClass('ion-page-invisible')
    .fromTo('opacity', '0', '1')
    .fromTo('transform', back ? 'translate3d(-28px,0,0) scale(0.97)' : 'translate3d(42px,0,0) scale(0.985)', 'translate3d(0,0,0) scale(1)');

  const root = ctrl.create().duration(duration).easing(easing).addAnimation(entering);

  if (opts.leavingEl) {
    root.addAnimation(
      ctrl
        .create()
        .addElement(opts.leavingEl)
        .fromTo('opacity', '1', '0')
        .fromTo('transform', 'translate3d(0,0,0) scale(1)', back ? 'translate3d(42px,0,0) scale(0.985)' : 'translate3d(-28px,0,0) scale(0.96)'),
    );
  }
  return root;
}
