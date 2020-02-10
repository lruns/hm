package ru.neyvan.hm.impacts;

import ru.neyvan.hm.game.Game;
import ru.neyvan.hm.screens.PlayScreen;

public abstract class Impact{
	private PlayScreen core;
	private float time;
	private

	public Impact(PlayScreen core){
		this.core = core;
	}
	public void update(float delta){
		time -= delta;
		if(time < 0) end();
	}

	
}